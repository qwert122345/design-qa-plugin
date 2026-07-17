const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");
const distDir = path.join(__dirname, "dist");
fs.mkdirSync(distDir, { recursive: true });

async function buildCode() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "src/code.ts")],
    outfile: path.join(distDir, "code.js"),
    bundle: true,
    format: "iife",
    target: "es2017",
  });
}

async function buildUi() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "src/ui.ts")],
    bundle: true,
    format: "iife",
    target: "es2017",
    write: false,
  });
  const bundledJs = result.outputFiles[0].text;
  const css = fs.readFileSync(
    path.join(__dirname, "src/styles.css"),
    "utf8"
  );
  const template = fs.readFileSync(
    path.join(__dirname, "src/ui.template.html"),
    "utf8"
  );
  const html = template
    .replace("/* __STYLES__ */", css)
    .replace("/* __SCRIPT__ */", bundledJs);
  fs.writeFileSync(path.join(distDir, "ui.html"), html);
}

async function run() {
  await buildCode();
  await buildUi();
  console.log("Build complete.");
  if (watch) {
    console.log("Watching src/ for changes...");
    fs.watch(path.join(__dirname, "src"), { recursive: true }, async () => {
      try {
        await buildCode();
        await buildUi();
        console.log("Rebuilt.");
      } catch (e) {
        console.error(e);
      }
    });
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
