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
  download(20, current * 20).then(a => {
    delete a.links;
    let filename = `${filePrefix}${current}.json`;
    let path = `${outputFolder}/${filename}`;

    fs.writeFile(path, JSON.stringify(a), err => {
      if (err) {
        console.error(`Something went wrong! We couldn't write the content to file '${path}'.`);
        console.error(err);
      }

      if (current !== stop) {
        recursive(current + 1);
      }
    });
  });
}
