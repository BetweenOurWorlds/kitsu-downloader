const fs = require('fs');
const download = require('./lib/downloader.js');

let start = parseInt(process.argv[2]);
let stop = parseInt(process.argv[3]);
let filePrefix = process.argv[4];
let outputFolder = process.argv[5];

if (start === undefined || stop === undefined || !filePrefix || !outputFolder) {
  console.error(`Incorrect usage. Use 'node index.js <start> <stop> <filePrefix> <outputFolder>'.`);
  process.exit(1);
}

recursive(start);

function recursive(current) {
  console.log(`working on ${current}`);

  download(20, current * 20).then(res => {
    let a = res.anime;
    delete a.links;

    let filenameAnime = `${filePrefix}-${current}.json`;
    let pathAnime = `${outputFolder}/${filenameAnime}`;
    let filenameStreams = `${filePrefix}-streams-${current}.json`
    let pathStreams = `${outputFolder}/${filenameStreams}`;

    fs.writeFile(pathAnime, JSON.stringify(a, null, 2), err => {
      if (err) {
        console.error(`Something went wrong! We couldn't write the content to file '${pathAnime}'.`);
        console.error(err);
      }

      fs.writeFile(pathStreams, JSON.stringify(res.streams, null, 2), err => {
        if (err) {
          console.error(`Something went wrong! We couldn't write the content to file '${pathStreams}'.`);
          console.error(err);
        }
	
        if (current !== stop) {
          recursive(current + 1);
        }
      });
    });
  });
}
