const fs = require('fs');
const download = require('./lib/downloader.js');

let offset = process.argv[2];
let filePrefix = process.argv[3];
let outputFolder = process.argv[4];

if (!offset || !filePrefix || !outputFolder) {
  console.error(`Incorrect usage. Use 'node index.js <offset> <filePrefix> <outputFolder>'.`);
  process.exit(1);
}

download(20, offset).then(a => {
  delete a.links;
  let filename = `${filePrefix}-${offset}.json`;
  let path = `${outputFolder}/${filename}`;

  fs.writeFile(path, JSON.stringify(a), err => {
    if (err) {
      console.error(`Something went wrong! We couldn't write the content to file '${path}'.`);
      console.error(err);
    }
  });
});
