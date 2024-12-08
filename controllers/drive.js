const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Paths and configuration
const CREDENTIALS_PATH = 'credentials.json'; // Path to your credentials.json
const TOKEN_PATH = 'token.json'; // Path to store the token

// Authorize and return Google Drive instance
async function authorize() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have a saved token
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oAuth2Client.setCredentials(token);

      // Check if the token is expired
      if (new Date() >= new Date(token.expiry_date)) {
        console.log('Token expired. Refreshing...');
        await refreshAccessToken(oAuth2Client);
      }
    } else {
      // If no token, get a new one
      await getAccessToken(oAuth2Client);
    }

    return google.drive({ version: 'v3', auth: oAuth2Client });
  } catch (error) {
    console.error('Authorization error:', error);
  }
}

// Refresh the access token
async function refreshAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    oAuth2Client.refreshAccessToken((err, tokens) => {
      if (err) return reject('Error refreshing access token: ' + err);
      console.log('Access token refreshed.');
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens)); // Save the new token
      resolve(oAuth2Client);
    });
  });
}
const prompt = require('prompt-sync')();
function getAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
    console.log('Authorize this app by visiting this URL:', authUrl);

    const input = require('prompt-sync')();
    const code = input('Enter the code from that page here: ');

    console.log('Code received:', code); // Debugging log

    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error('Error retrieving access token:', err.message);
        return reject(err);
      }

      if (!token) {
        console.error('No token received.');
        return reject(new Error('No token received from Google'));
      }

      console.log('Access token retrieved successfully:', token); // Correct usage of variable
      oAuth2Client.setCredentials(token);

      // Save the token to token.json
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', TOKEN_PATH);

      resolve(oAuth2Client);
    });
  });
}

// q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",


const listAllFolders = async (folderId) => {
  try {
    const drive = await authorize(); // Ensure authorization is successful
    if (!drive) throw new Error('Drive authorization failed.');

    let allFiles = [];
    let pageToken = null;

    // Loop through all pages of files in the folder
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and (mimeType = 'video/mp2t' or mimeType = 'application/vnd.apple.mpegurl')`,
        fields: "nextPageToken, files(id, name)",
        pageToken: pageToken,
      });

      // Check if the response is valid and contains files
      if (!res || !res.data || !res.data.files) {
        throw new Error('Unexpected response format or no files found');
      }

      // Concatenate the current page of files to the allFiles array
      allFiles = allFiles.concat(res.data.files);
      pageToken = res.data.nextPageToken;

    } while (pageToken); // Continue fetching the next page if it exists

    // Log the files fetched from the Drive
    // console.log('Files in Drive:', allFiles.length);
    // allFiles.forEach((file) => {
    //   console.log(`File Name: ${file.name}, File ID: ${file.id}`);
    // });

    return allFiles;

  } catch (error) {
    console.error('Error listing files:', error.message);
    return [];
  }
};


// Main function to create folder and upload its contents
async function main(fileName) {
  try {
    const FOLDER_PATH = `./down/${fileName}`; // Replace with your local folder path
    const drive = await authorize();

    const folderName = path.basename(FOLDER_PATH); // Use local folder name for Drive folder
    const driveFolderId = await createDriveFolder(drive, folderName);

    console.log(`Uploading contents of folder "${FOLDER_PATH}" to Google Drive...`);
    await uploadFolder(drive, FOLDER_PATH, driveFolderId);

    console.log(`All files uploaded to folder "${folderName}" on Google Drive.`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Function to create a folder in Google Drive
async function createDriveFolder(drive, folderName) {
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  try {
    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    console.log(`Folder "${folderName}" created with ID: ${folder.data.id}`);
    return folder.data.id;
  } catch (error) {
    console.error('Error creating folder:', error.message);
  }
}

// Upload a file to a specific folder
async function uploadFile(drive, filePath, fileName, folderId) {
  const fileMetadata = {
    name: fileName,
    parents: [folderId], // Upload to the specified folder
  };

  const media = {
    mimeType: fileName.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t',
    body: fs.createReadStream(filePath),
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });
    console.log(`Uploaded ${fileName}. File ID: ${file.data.id}`);
    return file.data.id;
  } catch (error) {
    console.error('Error uploading file:', error.message);
  }
}

// Upload all files in a local folder
async function uploadFolder(drive, localFolderPath, driveFolderId) {
  const files = fs.readdirSync(localFolderPath);

  for (const file of files) {
    const filePath = path.join(localFolderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      await uploadFile(drive, filePath, file, driveFolderId);
    } else {
      console.log(`Skipping non-file: ${filePath}`);
    }
  }
}
async function streamTsFile(file, res) {
  try {
    const drive = await authorize(); // Ensure correct authorization
    const response = await drive.files.get(
      { fileId: file.id, alt: 'media' },
      { responseType: 'stream' }
    );

    console.log('Serving file:', file.id);  // Log the file ID
    response.data.pipe(res);  // Stream file to response

    response.data.on('end', () => {
      console.log(`Finished streaming file: ${file.id}`);
    });
  } catch (error) {
    console.error('Error streaming .ts file:', error.message);
    res.status(500).send('Error streaming the file');
  }
}






async function fetchFileContents(fileId) {
  const drive = await authorize(); // Ensure you have the Google Drive authorization
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  let content = '';
  return new Promise((resolve, reject) => {
    response.data
      .on('data', (chunk) => {
        content += chunk.toString(); // Append chunks to form the file content
      })
      .on('end', () => resolve(content)) // Resolve the promise with the final content
      .on('error', (err) => reject(err)); // Reject on error
  });
}










// Export the functions if needed for testing or other use cases
module.exports = {
  main,
  listAllFolders,
  fetchFileContents,
  streamTsFile,
};






























// const fs = require('fs');
// const path = require('path');
// const { google } = require('googleapis');

// // Paths and configuration
//  // Replace with your local folder path
// const CREDENTIALS_PATH = 'credentials.json'; // Path to your credentials.json
// const TOKEN_PATH = 'token.json'; // Path to store the token

// // Authorize and return Google Drive instance
// async function authorize() {
//   const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
//   const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;
//   const oAuth2Client = new google.auth.OAuth2(
//     client_id,
//     client_secret,
//     redirect_uris[0]
//   );

//   if (fs.existsSync(TOKEN_PATH)) {
//     const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
//     oAuth2Client.setCredentials(token);

//     oAuth2Client.on('tokens', (tokens) => {
//       if (tokens.refresh_token) {
//         console.log('Saving new refresh token to disk...');
//         fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
//       }
//     });

//     if (new Date() >= new Date(token.expiry_date)) {
//       console.log('Token expired. Refreshing...');
//       await getAccessToken(oAuth2Client);
//     }
//   } else {
//     await getAccessToken(oAuth2Client);
//   }

//   return google.drive({ version: 'v3', auth: oAuth2Client });
// }

// // Get a new token
// function getAccessToken(oAuth2Client) {
//   return new Promise((resolve, reject) => {
//     const authUrl = oAuth2Client.generateAuthUrl({
//       access_type: 'offline',
//       scope: ['https://www.googleapis.com/auth/drive.file'],
//     });
//     console.log('Authorize this app by visiting this URL:', authUrl);

//     const readline = require('readline').createInterface({
//       input: process.stdin,
//       output: process.stdout,
//     });

//     readline.question('Enter the code from that page here: ', (code) => {
//       readline.close();
//       oAuth2Client.getToken(code, (err, token) => {
//         if (err) return reject('Error retrieving access token: ' + err);
//         oAuth2Client.setCredentials(token);

//         fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
//         console.log('Token stored to', TOKEN_PATH);
//         resolve(oAuth2Client);
//       });
//     });
//   });
// }

// // Create a folder in Google Drive
// async function createDriveFolder(drive, folderName) {
//   const fileMetadata = {
//     name: folderName,
//     mimeType: 'application/vnd.google-apps.folder',
//   };

//   try {
//     const folder = await drive.files.create({
//       resource: fileMetadata,
//       fields: 'id',
//     });

//     console.log(`Folder "${folderName}" created with ID: ${folder.data.id}`);
//     return folder.data.id;
//   } catch (error) {
//     console.error('Error creating folder:', error.message);
//   }
// }

// // Upload a file to a specific folder
// async function uploadFile(drive, filePath, fileName, folderId) {
//   const fileMetadata = {
//     name: fileName,
//     parents: [folderId], // Upload to the specified folder
//   };

//   const media = {
//     mimeType: fileName.endsWith('.m3u8')
//       ? 'application/vnd.apple.mpegurl'
//       : 'video/mp2t',
//     body: fs.createReadStream(filePath),
//   };

//   try {
//     const file = await drive.files.create({
//       resource: fileMetadata,
//       media: media,
//       fields: 'id',
//     });
//     console.log(`Uploaded ${fileName}. File ID: ${file.data.id}`);
//     return file.data.id;
//   } catch (error) {
//     console.error('Error uploading file:', error.message);
//   }
// }

// // Upload all files in a local folder
// async function uploadFolder(drive, localFolderPath, driveFolderId) {
//   const files = fs.readdirSync(localFolderPath);

//   for (const file of files) {
//     const filePath = path.join(localFolderPath, file);
//     const stat = fs.statSync(filePath);

//     if (stat.isFile()) {
//       await uploadFile(drive, filePath, file, driveFolderId);
//     } else {
//       console.log(`Skipping non-file: ${filePath}`);
//     }
//   }
// }

// // Main function to create folder and upload its contents
// async function main(fileName) {
//   try {
//     const FOLDER_PATH = `./down/${fileName}`; // Replace with your local folder path
//     const drive = await authorize();

//     const folderName = path.basename(FOLDER_PATH); // Use local folder name for Drive folder
//     const driveFolderId = await createDriveFolder(drive, folderName);

//     console.log(`Uploading contents of folder "${FOLDER_PATH}" to Google Drive...`);
//     await uploadFolder(drive, FOLDER_PATH, driveFolderId);

//     console.log(`All files uploaded to folder "${folderName}" on Google Drive.`);
//   } catch (error) {
//     console.error('Error:', error.message);
//   }
// }












// const listAllFolders = async () => {
//   const drive = authorize();

//   try {
//     const res = await drive.files.list({
//       q: "mimeType = 'application/vnd.google-apps.folder'",
//       fields: "files(id, name, mimeType, createdTime, modifiedTime, parents, trashed, starred, iconLink)"
//     });
    

//     console.log("Folders in Drive:");
//     res.data.files.forEach((folder) => {
//       console.log(`Folder Name: ${folder.name}, Folder ID: ${folder.id}`);
//     });

//     return res.data.files;  // This returns an array of folder objects
//   } catch (error) {
//     console.error("Error listing folders:", error.message);
//     return [];
//   }
// };

 

// module.exports = {
//   main,
//   listAllFolders,
// };













// const fs = require('fs');
// const path = require('path')
// const {google} = require('googleapis');

// const Folder_Path = './nps';
// const Credentials_Path = 'credentials.json';
// const Token_Path = 'token.json';


// async function authorize (){
//     const credentials = JSON.parse(fs.readFileSync(Credentials_Path));
//     const { client_id, client_secret, redirect_uris } = credentials.web || credentials.installed;

//     const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

//     if(fs.existsSync(Token_Path)){
//         const token = JSON.parse(fs.readFileSync(Token_Path));
//         oAuth2Client.setCredentials(token);
        
//         oAuth2Client.on('tokens', (tokens) => {
//           if(tokens.refresh_token){
//             console.log('Refresh Token:', tokens.refresh_token);
//             fs.writeFileSync(Token_Path, JSON.stringify(tokens));
//           }
//       });

//       if(new Date() >= new Date(token.expiry_date)){
//        console.log('Token Expired');
//        await oAuth2Client.getAccessToken();
//         // const newToken = await oAuth2Client.refreshAccessToken();
//         // oAuth2Client.setCredentials(newToken.credentials);
//         // fs.writeFileSync(Token_Path, JSON.stringify(newToken.credentials));
//       }
//     }else {
//       await getAccessToken(oAuth2Client);
//     }
//     return google.drive({version: 'v3', auth: oAuth2Client});
// }


// function getAccessToken(oAuth2Client){
//   return new Promise((resolve, reject) => {
//      const authUrl = oAuth2Client.generateAuthUrl({
//       access_type: 'offline',
//       scope: ['https://www.googleapis.com/auth/drive.file'],
//      });
//      console.log('Authorize this app by visiting this URL:', authUrl);
//      const readline = require('readline').createInterface({
//       input: process.stdin,
//       output: process.stdout,
//      });

//      readline.question('Enter the code from that page here: ',  (code) => {
//       readline.close();
//       oAuth2Client.getToken(code, (err, token) =>{
//         if (err) return reject('Error retrieving access token: ' + err);

//         oAuth2Client.setCredentials(token);

//         fs.writeFileSync(Token_Path, JSON.stringify(token));
//         console.log('Token stored to', Token_Path);
//         resolve(oAuth2Client);
//       })
//      });
//   })
// }


// async function uploadFile(drive, filePath, fileName){
//     const fileMetadata = {name: fileName};

//     const media = {
//         mimeType: fileName.endsWith('.m3u8') ? 'application.vnd.apple.mpegurl' : 'video/mp2t',
//         body: fs.createReadStream(filePath),
//     };

//     try{
//       const file = await drive.files.create({
//         resource: fileMetadata,
//         media: media,
//         fields: 'id',
//       });
//       console.log(`Uploaded ${fileName}. File ID: ${file.data.id}`);
//       return file.data.id;
//     }catch(error){
//       console.error('Error uploading file:', error.message);
//     }
// }

// // async function makeFilePublic(drive, fileId){
// //   try{
// //     await drive.permissions.create({
// //       fileId: fileId,
// //       requestBody: {
// //         role: 'reader',
// //         type: 'anyone',
// //       },
// //     });
// //     console.log('File is now public');
// //   }catch(error){
// //     console.error('Error making file public:', error.message);
// //   }
// // }

// async function getAuthenticatedUrl(drive, fileId){
//   try{
//     const file = await drive.files.get({
//       fileId: fileId,
//       fields: 'id, name, webContentLink, webViewLink',
//     })
//     const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
//     console.log(`Authenticated URL for file: ${file.name} - ${downloadUrl}`);
//     return downloadUrl;
//   }catch(error){
//     console.error('Error getting authenticated URL:', error.message);
//   }
// }


// async function main (){
//   try{
//     const drive = await authorize();

//     const files = fs.readdirSync(Folder_Path);
//     const fileLinks = {}

//     for(const file of files){
//       const filePath = path.join(Folder_Path, file);
//       const fileId = await uploadFile(drive, filePath, file);
//       const AuthenticatedUrl = await getAuthenticatedUrl(drive, fileId);
//       fileLinks[file] = AuthenticatedUrl;
//     }

//     console.log('All files uploaded');
//     console.log(fileLinks);

//     const m3u8Link = fileLinks['nps.m3u8']; 
//     console.log(`Stream your HLS content using this authenticated .m3u8 link: ${m3u8Link}`);
//   }catch (error) {
//     console.error('Error:', error.message);
//   }
// }

// module.exports = main;