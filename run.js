const fs = require('fs');
const path = require('path');
const http = require('http');
// const main = require('./controllers/uploadtodrive');
const { listAllFolders } = require('./controllers/drive');
 

// Define the directory where the .m3u8 and .ts files are located
const HLS_DIRECTORY = path.join(__dirname, '/down/ngs'); // Replace with your actual directory

// Start an HTTP server to serve .m3u8 and .ts files
function startServer() {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Decode the URL path and join it with the HLS_DIRECTORY
    const requestedPath = decodeURIComponent(req.url); 
    const filePath = path.join(HLS_DIRECTORY, requestedPath); 
    
    console.log("Requested file path: ", filePath); // Log the requested file path

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log("File not found: ", filePath); // Log if the file is not found
      res.statusCode = 404;
      res.end('File not found');
      return;
    }

    // Determine content type based on file extension
    let contentType;
    if (filePath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (filePath.endsWith('.ts')) {
      contentType = 'video/mp2t';
    } else {
      res.statusCode = 400;
      res.end('Unsupported file type');
      return;
    }

    // Log that the file is being served
    console.log(`Serving file: ${filePath}`);

    // Serve the file
    res.writeHead(200, { 'Content-Type': contentType });
    const fileStream = fs.createReadStream(filePath);
    console.log(`Serving file: ${fileStream}`);
    // Log the streaming action
    fileStream.on('open', () => {
      console.log(`Started streaming: ${filePath}`);
    });

    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  });

  const PORT = 8000;
  server.listen(PORT, () => {
    console.log(`HLS server is running at http://localhost:${PORT}/`);
    console.log(`Serving files from directory: ${HLS_DIRECTORY}`);
  });
}

// Start the server
// startServer();


listAllFolders('1v_D2A8znEY9ZfFj9FbOSUP2f7zMNvtqv');


// const fs = require("fs");
// const path = require("path");
// const http = require("http");
// const { execSync, spawn } = require("child_process");
// const cliProgress = require("cli-progress");

// const pathToFFmpeg = "C:\\ffmpeg\\bin\\ffmpeg.exe"; // Adjust this to your FFmpeg path

// // Check if FFmpeg is installed
// function checkFFmpeg() {
//   try {
//     execSync(`${pathToFFmpeg} -version`, { stdio: "ignore" });
//   } catch {
//     console.error("FFMPEG is not installed or not accessible in the system");
//     process.exit(1);
//   }
// }

// // Display progress bar for FFmpeg process
// function ffmpegProgressBar(command) {
//   const process = spawn(command[0], command.slice(1));
//   let duration = null;
//   const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.\d+/;
//   const timeRegex = /time=(\d{2}):(\d{2}):(\d{2})/;

//   const progressBar = new cliProgress.SingleBar(
//     {
//       format: "Converting |{bar}| {percentage}% | {value}/{total} seconds",
//     },
//     cliProgress.Presets.shades_classic
//   );

//   process.stderr.on("data", (data) => {
//     const line = data.toString();
//     if (!duration) {
//       const durationMatch = durationRegex.exec(line);
//       if (durationMatch) {
//         const [hours, minutes, seconds] = durationMatch.slice(1).map(Number);
//         duration = hours * 3600 + minutes * 60 + seconds;
//         progressBar.start(duration, 0);
//       }
//     }
//     const timeMatch = timeRegex.exec(line);
//     if (timeMatch) {
//       const [hours, minutes, seconds] = timeMatch.slice(1).map(Number);
//       const currentTime = hours * 3600 + minutes * 60 + seconds;
//       progressBar.update(currentTime);
//     }
//   });

//   process.on("close", (code) => {
//     progressBar.stop();
//     if (code === 0) {
//       console.log("Conversion completed successfully.");
//       startServer(); // Start the server after conversion
//     } else {
//       console.error("FFmpeg process failed.");
//       process.exit(1);
//     }
//   });
// }

// // Convert input MP4 file to HLS (M3U8 + TS files)
// function convertToM3U8(inputFile, directory) {
//   const outputFilename = path.parse(inputFile).name;
//   const command = [
//     pathToFFmpeg,
//     "-i",
//     inputFile,
//     "-c:v",
//     "libx264",
//     "-c:a",
//     "aac",
//     "-hls_time",
//     "3",
//     "-hls_list_size",
//     "0",
//     "-hls_segment_filename",
//     `${directory}/${outputFilename}-segment_%03d.ts`,
//     `${directory}/${outputFilename}.m3u8`,
//   ];
//   ffmpegProgressBar(command);
// }

// // Create output directory
// function createDirectory(inputFile) {
//   const directory = path.join(__dirname, path.parse(inputFile).name);
//   if (!fs.existsSync(directory)) {
//     fs.mkdirSync(directory);
//   }
//   convertToM3U8(inputFile, directory);
// }

// // Start an HTTP server to serve .m3u8 and .ts files
// function startServer() {
//   const HLS_DIRECTORY = path.join(__dirname, path.parse(inputFile).name);

//   const server = http.createServer((req, res) => {
//     const requestedPath = decodeURIComponent(req.url); // Decode requested URL path
//     const filePath = path.join(HLS_DIRECTORY, requestedPath); // Resolve file path

//     // Check if file exists
//     if (!fs.existsSync(filePath)) {
//       res.statusCode = 404;
//       res.end("File not found");
//       return;
//     }

//     // Determine content type based on file extension
//     let contentType;
//     if (filePath.endsWith(".m3u8")) {
//       contentType = "application/vnd.apple.mpegurl";
//     } else if (filePath.endsWith(".ts")) {
//       contentType = "video/mp2t";
//     } else {
//       res.statusCode = 400;
//       res.end("Unsupported file type");
//       return;
//     }

//     // Serve the file
//     res.writeHead(200, { "Content-Type": contentType });
//     const fileStream = fs.createReadStream(filePath);
//     console.log(`Serving file: ${fileStream}`);
//     fileStream.pipe(res);

//     fileStream.on("error", (error) => {
//       console.error("Stream error:", error);
//       res.statusCode = 500;
//       res.end("Internal Server Error");
//     });
//   });

//   const PORT = 8000;
//   server.listen(PORT, () => {
//     console.log(`HLS server is running at http://localhost:${PORT}/`);
//     console.log(`Serving files from directory: ${HLS_DIRECTORY}`);
//   });
// }

// // Main script execution
// if (process.argv.length !== 3) {
//   console.error("Usage: node index.js input-filename.mp4");
//   process.exit(1);
// }
// const inputFile = process.argv[2];

// // Validate FFmpeg and input file
// checkFFmpeg();
// if (!fs.existsSync(inputFile)) {
//   console.error("Input file does not exist.");
//   process.exit(1);
// }

// // Create output directory and convert video
// createDirectory(inputFile);
