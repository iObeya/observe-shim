// exported expect, sinon

global.expect = require('expect.js');
global.sinon = require('sinon');
require('../lib/observer-shim.js');
require('./Object.observe');
require('./bugs');
