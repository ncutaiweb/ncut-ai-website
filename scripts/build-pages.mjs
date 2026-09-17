import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import SiteReferences from "../site-references.js";

class StaticSiteBuilder {
  constructor(root) {
    this.root = root;
    this.outDir = join(root, "dist");
    this.files = [
      "404.html",
      "awards.html",
      "campus-links.html",
      "faculty-detail.html",
      "faculty.html",
      "index.html",
      "manifest.webmanifest",
      "news-detail.html",
      "news.html",
      "official-detail.html",
      "official.html",
      "original.html",
      "page.html",
      "resources.html",
      "robots.txt",
      "script.js",
      "site-references.js",
      "sitemap.xml",
      "student-resource.html",
      "styles.css"
    ];
    this.directories = ["assets", "data"];
    this.jsonFiles = ["data/site.json", "data/official-pages.json", "manifest.webmanifest"];
  }

  async build() {
    const source = JSON.parse(StaticSiteBuilder.stripBom(await readFile(join(this.root, "data/site.json"), "utf8")));
    SiteReferences.resolve(source); // Fail before building if a reference is missing or cyclic.
    await rm(this.outDir, { recursive: true, force: true });
    await mkdir(this.outDir, { recursive: true });
    await Promise.all(this.files.map((file) => this.copyFilePreservingPath(file)));
    await Promise.all(this.directories.map((directory) => this.copyDirectory(directory)));
    await Promise.all(this.jsonFiles.map((file) => this.normalizeJson(file)));
    await writeFile(join(this.outDir, ".nojekyll"), "", "utf8");
    console.log(`GitHub Pages static build written to ${this.outDir}`);
  }

  async copyFilePreservingPath(file) {
    const source = join(this.root, file);
    const target = join(this.outDir, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);
  }

  async copyDirectory(directory) {
    await cp(join(this.root, directory), join(this.outDir, directory), {
      recursive: true,
      filter: (source) => !source.includes(`${directory}\\backups`) && !source.includes(`${directory}/backups`)
    });
  }

  async normalizeJson(file) {
    const target = join(this.outDir, file);
    const text = StaticSiteBuilder.stripBom(await readFile(target, "utf8"));
    JSON.parse(text);
    await writeFile(target, text, "utf8");
  }

  static stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
await new StaticSiteBuilder(root).build();
