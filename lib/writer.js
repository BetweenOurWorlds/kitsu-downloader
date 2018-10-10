/**
 * author: Pieter Heyvaert (pheyvaer.heyvaert@ugent.be)
 * Ghent University - imec - IDLab
 */

const Q = require('q');
const logger = require('./logger');
const fs = require('fs');

class Writer {

  constructor(outputFolderPath) {
    this.outputFolderPath = outputFolderPath;
  }

  write(results) {
    const promises = [];

    results.forEach(result => {
      const deferred = Q.defer();
      promises.push(deferred.promise);
      const filePath = `${this.outputFolderPath}/${result.path}`;

      fs.writeFile(filePath, JSON.stringify(result.data, null, 2), err => {
        if (err) {
          logger.error(`Something went wrong! We couldn't write the content to file '${filePath}'.`);
          logger.error(err);
          deferred.reject(err);
        }
      });
    });

    return Q.all(promises);
  }
}

module.exports = Writer;