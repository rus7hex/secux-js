import "./node_modules/mocha/mocha";


mocha.setup("bdd");
mocha.reporter("json");

global.location = {};