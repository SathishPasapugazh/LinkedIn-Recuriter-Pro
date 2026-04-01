import fs from 'fs';
fetch('https://js.puter.com/v2/')
  .then(res => res.text())
  .then(text => {
    fs.writeFileSync('puter.js', text);
    console.log('Downloaded puter.js');
  })
  .catch(err => console.error(err));
