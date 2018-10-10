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
const kitsu = new Kitsu();

function download(limit, offset) {
  const deferred = Q.defer();

  kitsu.get('characters',  {
    page: { limit, offset }
  }).then(res => {
    res.data.forEach(character => {
      deleteUnwantedData(character);
    });

    deferred.resolve(res);
  });

  return deferred.promise;
}

function deleteUnwantedData(character) {
  delete character.relationships;
  delete character.attributes.createdAt;
  delete character.attributes.updatedAt;
  delete character.type;
  delete character.links;
}

module.exports = download;