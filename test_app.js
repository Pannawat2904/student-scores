const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('public/index.html', 'utf8');
const dom = new JSDOM(html);
global.document = dom.window.document;
global.window = dom.window;
global.requestAnimationFrame = (cb) => cb();

const appJsCode = fs.readFileSync('public/js/app.js', 'utf8');

try {
  eval(appJsCode);
  const mockData = {
    name: "Test", subject: "Math", work: 10, mid: 10, jit: 10, final: 10, assignments: []
  };
  renderResult("123", mockData);
  console.log("renderResult success!");
  console.log("resultPanel classes:", document.getElementById("result-panel").className);
} catch(e) {
  console.error("CRASH:", e);
}
