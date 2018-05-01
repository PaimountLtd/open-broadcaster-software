const searchExp = /\$t\(\'([ a-zA-Z\d\-_`@%;:,'’=&!~#\\\+\*\?\.\}\{\(\)\[\]\$/]+)\'.*?\)/gm;
const fs = require('fs');
const recursive = require('recursive-readdir');


(async function main() {

  const dictionary = {};

  // load dictionary
  const dictionaryFiles = await recursive('./app/i18n/en-US', ['.txt']);
  dictionaryFiles.forEach(filePath => {
    const fileDictionary = JSON.stringify(fs.readFileSync(filePath).toString());
    Object.assign(dictionary, fileDictionary);
  });



  const sourceFiles = await recursive('./app', ['.txt']);


  sourceFiles.forEach(filePath => {
    const foundStrings = [];
    const missedStrings = [];

    const fileContent = fs.readFileSync(filePath).toString();
    let match;
    while (match = searchExp.exec(fileContent)) {
      const string = match[1];
      if (!foundStrings.includes(string)) foundStrings.push(string);
    }

    foundStrings.forEach(str => {
      if (dictionary[str] || missedStrings.includes(str)) return;
      missedStrings.push(str);
    });

    if (foundStrings.length) {
      console.log('check', filePath);
      console.log('found', foundStrings);
    }

    if (!missedStrings.length) return;

    console.log(`missed strings found in ${filePath}`);

    const missedStringsMap = {};
    missedStrings.forEach(missedString => {
      missedStringsMap[missedString] = missedString;
    })

    console.log(JSON.stringify(missedStringsMap, null, 4));
  });



})();





