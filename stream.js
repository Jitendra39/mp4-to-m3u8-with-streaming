const express = require('express');
const { listAllFolders, streamTsFile, fetchFileContents } = require('./controllers/drive'); // Ensure your drive controller is correctly set up
const app = express();
const PORT = process.env.PORT || 9000;

app.use(require('cors')());

let files = [];

app.get('/ad', async (req, res) => {
  const folderId = req.query.text; // Folder ID passed as a query parameter
console.log("folderId",folderId);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (!folderId) {
    return res.status(400).send('No folder ID provided.');
  }

  try {
    // List all the files in the folder
     files = await listAllFolders(folderId);
  console.log("files",files);
    // Check if there are any files
    if (files.length === 0) {
      return res.status(404).send('No files found in the folder.');
    }
    // Locate the .m3u8 file in the folder
    const m3u8File = files.find((file) => file.name.endsWith('.m3u8'));
    if (!m3u8File) {
      return res.status(404).send('No .m3u8 file found in the folder.');
    }

    // Fetch the contents of the .m3u8 file from the storage (e.g., Google Drive)
    const m3u8Content = await fetchFileContents(m3u8File.id); // Function to fetch file content based on ID

    // Replace relative segment URLs with absolute URLs
    const baseUrl = `http://localhost:9000`; // Base URL for segment files
    const updatedM3u8Content = m3u8Content.replace(/([^\s]+\.ts)/g, `${baseUrl}/$1`);
    console.log("updatedM3u8Content",updatedM3u8Content);
    // Serve the updated .m3u8 playlist
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(updatedM3u8Content);
  } catch (error) {
    console.error("Error serving .m3u8 file:", error.message);
    res.status(500).send('Internal Server Error');
  }
});

 


// Serve each .ts chunk
app.get('/:fileId.ts', async (req, res) => {
  const fileId = req.params.fileId;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
let id;
if(fileId){
  const file = files.find((file) => file.name === `${fileId}.ts`);
  if (file) {
    id = file.id;
  }
}
console.log("id",id);
  try {
    const file = { id: id }; // Replace with the correct logic to fetch the file
    await streamTsFile(file, res); // Stream the `.ts` file from Google Drive
  } catch (error) {
    console.error('Error streaming .ts file:', error.message);
    res.status(500).send('Error streaming the file');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});










// const express = require('express');
// const { listAllFolders, streamTsFile } = require('./controllers/drive');
// const app = express();
// const PORT = process.env.PORT || 9000;
// app.use(require('cors')());
// app.get('/ad', async(req, res) => {
//   const qu = req.query;
//   console.log('Received query:', qu);
//   const files = await listAllFolders(qu.text);
//   console.log('files:', files);
//   if (files.length === 0) {
//     res.status(404).send('No .ts files found in the folder');
//     return;
//   }


//   res.setHeader('Transfer-Encoding', 'chunked'); 
//   res.write(`-- File: ${files.name} --\n`);
//   console.log("files",files);
 
//     // Stream each .ts file sequentially
//     for (const file of files) {
//      streamTsFile(file, res);
//     }
// console.log("end file");
//     res.end();
// });









// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });