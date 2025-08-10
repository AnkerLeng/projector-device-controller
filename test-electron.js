console.log("Test electron start");
const { app, BrowserWindow } = require("electron");

app.on("ready", () => {
  console.log("App ready");
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });
  
  win.loadURL("data:text/html,<h1>Hello Electron\!</h1>");
  console.log("Window created");
});
