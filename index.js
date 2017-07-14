const fs = require('fs');
const download = require('./lib/downloader.js');

let offset = process.argv[2];
let filePrefix = process.argv[3];
let outputFolder = process.argv[4];

if (!offset || !filePrefix || !outputFolder) {
  console.error(`Incorrect usage. Use 'node index.js <offset> <filePrefix> <outputFolder>'.`);
  process.exit(1);
}

download(20, offset).then(res => {
  let a = res.anime;
  delete a.links;
  let filenameAnime = `${filePrefix}-${offset}.json`;
  let pathAnime = `${outputFolder}/${filenameAnime}`;
  let filenameStreams = `${filePrefix}-streams-${offset}.json`
  let pathStreams = `${outputFolder}/${filenameStreams}`;

  fs.writeFile(pathAnime, JSON.stringify(a, null, 2), err => {
    if (err) {
      console.error(`Something went wrong! We couldn't write the content to file '${pathAnime}'.`);
      console.error(err);
    }
  });

  fs.writeFile(pathStreams, JSON.stringify(res.streams, null, 2), err => {
    if (err) {
      console.error(`Something went wrong! We couldn't write the content to file '${pathStreams}'.`);
      console.error(err);
    }
  });
});
