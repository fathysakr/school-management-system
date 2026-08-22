const os = require('os');
console.log('USERNAME env:', process.env.USERNAME);
console.log('os.userInfo().username:', os.userInfo().username);
console.log('USER env:', process.env.USER);
