/**
 * author: Pieter Heyvaert (pheyvaer.heyvaert@ugent.be)
 * Ghent University - imec - IDLab
 */

const fs = require('fs');
const download = require('./lib/downloadCharacters.js');

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
    //console.log(res);

    let filenameCharacter = `${filePrefix}-${current}.json`;
    let pathCharacter = `${outputFolder}/${filenameCharacter}`;

    fs.writeFile(pathCharacter, JSON.stringify(res, null, 2), err => {
      if (err) {
        console.error(`Something went wrong! We couldn't write the content to file '${pathCharacter}'.`);
        console.error(err);
      }

      if (current !== stop) {
        recursive(current + 1);
      }
    });
  }).catch(e => {
    console.error(`error during ${current}. Retrying...`);
    recursive(current);
  });
}
