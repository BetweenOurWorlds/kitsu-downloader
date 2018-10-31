/**
 * author: Pieter Heyvaert (pheyvaer.heyvaert@ugent.be)
 * Ghent University - imec - IDLab
 */

/**
 * author: Pieter Heyvaert (pheyvaer.heyvaert@ugent.be)
 * Ghent University - imec - IDLab
 */

const Q = require('q');
const Kitsu = require('kitsu');
const logger = require('./logger');

class CharacterDownloader {

  constructor(writer) {
    this.writer = writer;
    this.kitsu = new Kitsu();
  }

  downloadRecursive(currentPage, stopPage) {
    logger.debug(`working on page ${currentPage}`);

    this._download(20, currentPage * 20).then(res => {
      //console.log(res);

      let filenameCharacter = `character-${currentPage}.json`;

      const data = [{
        data: res,
        path: filenameCharacter
      }];

      this.writer.write(data).then(() => {
        if (currentPage !== stopPage) {
          this.downloadRecursive(currentPage + 1, stopPage);
        }
      });
    }).catch(e => {
      logger.error(`error during ${currentPage}: ${e.message}. Retrying...`);
      this.downloadRecursive(currentPage, stopPage);
    });
  }

  _download(limit, offset) {
    const deferred = Q.defer();

    this.kitsu.get('characters',  {
      page: { limit, offset }
    }).then(res => {
      res.data.forEach(character => {
        this._deleteUnwantedData(character);
      });

      deferred.resolve(res);
    });

    return deferred.promise;
  }

  _deleteUnwantedData(character) {
    delete character.relationships;
    delete character.attributes.createdAt;
    delete character.attributes.updatedAt;
    delete character.type;
    delete character.links;
  }
}

module.exports = CharacterDownloader;