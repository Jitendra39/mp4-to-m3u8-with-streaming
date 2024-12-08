const fs = require('fs');
const path = require('path'); // Import the 'path' module
const { execSync, spawn } = require('child_process');
const cliProgress = require('cli-progress'); // Import the progress bar module
const main = require('./controllers/drive');
const pathToFFmpeg = 'C:\\ffmpeg\\bin\\ffmpeg.exe'; // Path to ffmpeg executable

function checkFFmpeg() {
  try {
    execSync(`${pathToFFmpeg} -version`, { stdio: 'ignore' });
  } catch (error) {
    console.error('ffmpeg is not installed or not accessible.');
    process.exit(1);
  }
}

function ffmpegProgressBar(command, baseName) {
  command[0] = pathToFFmpeg; // Ensure ffmpeg path is used
  const process = spawn(command[0], command.slice(1));
  let duration = null;
  const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.\d{2}/;
  const timeRegex = /time=(\d{2}):(\d{2}):(\d{2})\.\d{2}/;

  const progressBar = new cliProgress.SingleBar({
    format: 'Converting |{bar}| {percentage}% | {value}/{total} seconds',
  }, cliProgress.Presets.shades_classic);

  process.stderr.on('data', (data) => {
    const line = data.toString();
    if (!duration) {
      const durationMatch = durationRegex.exec(line);
      if (durationMatch) {
        const [hours, minutes, seconds] = durationMatch.slice(1).map(Number);
        duration = hours * 3600 + minutes * 60 + seconds;
        progressBar.start(duration, 0);
      }
    }
    const timeMatch = timeRegex.exec(line);
    if (timeMatch) {
      const [hours, minutes, seconds] = timeMatch.slice(1).map(Number);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      progressBar.update(currentTime);
    }
  });

  process.on('close', () => {
    progressBar.stop();
    console.log('Conversion completed.');
    main(baseName);
  });
}

function convertToM3U8(inputFile, directory, baseName) {
  const outputFilename = path.parse(inputFile).name;
  const command = [
    pathToFFmpeg,
    '-i', inputFile,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-hls_time', '3',
    '-hls_list_size', '0',
    '-hls_segment_filename', `${directory}/${outputFilename}-segment_%03d.ts`,
    `${directory}/${outputFilename}.m3u8`
  ];
  ffmpegProgressBar(command, baseName);
}

function createDirectory(inputFile) {
  const baseName = path.parse(inputFile).name;
  const directory = path.join('down', baseName)
  // Directory is the base name of the input file
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory); // Create the directory if it doesn't exist
  }
  convertToM3U8(inputFile, directory, baseName); 
  // Start the conversion process
   
}

if (process.argv.length !== 3) {
  console.error('Usage: node index.js input-filename.mp4');
  process.exit(1);
}


const inputFile = process.argv[2];
console.log(inputFile)
checkFFmpeg();

if (!fs.existsSync(inputFile)) {
  console.error('Input file does not exist.');
  process.exit(1);
}

 createDirectory(inputFile);
 