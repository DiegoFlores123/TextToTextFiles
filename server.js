const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const pandoc = require("pandoc-bin"); // Usando pandoc-bin, porque no me gusta instalar software externo
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph } = require("docx");

const app = express();
const PORT = 3000;

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/download", (req, res) => {
  const { text, format } = req.body;
  const filename = `output.${format}`;
  const filePath = path.join(__dirname, filename);

  // Guardar directamente los formatos simples (HTML, RTF y TXT)
  if (format === "txt" || format === "html" || format === "rtf") {
    let content = text;
    if (format === "html") {
      content = `<html><body><p>${text.replace(/\n/g, "<br>")}</p></body></html>`;
    } else if (format === "rtf") {
      content = `{\rtf1\ansi\deff0 {\\fonttbl {\\f0 Arial;}} \\f0\\fs24 ${text.replace(/\n/g, "\\par ")}\\par }`;
    }

    fs.writeFileSync(filePath, content, "utf8");
    return res.download(filePath, filename, (err) => {
      if (err) console.error(err);
      fs.unlinkSync(filePath);
    });
  }

  // Generar PDF con PDFKit
  else if (format === "pdf") {
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, filename);
    const stream = fs.createWriteStream(pdfPath);
  
    const formattedText = text.replace(/\r?\n|\r/g, "\n");
    doc.pipe(stream);
    
    doc.text(formattedText, {
      lineBreak: true
    });
  
    doc.end();
  
    stream.on("finish", () => {
      res.download(pdfPath, filename, (err) => {
        if (err) console.error(err);
        fs.unlinkSync(pdfPath);
      });
    });
    return;
  }

  // Generar DOCX con docx
  else if (format === "docx") {
    const paragraphs = text.split("\n").map(line => new Paragraph(line));

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    Packer.toBuffer(doc).then((buffer) => {
      fs.writeFileSync(filePath, buffer);
      res.download(filePath, filename, (err) => {
        if (err) console.error(err);
        fs.unlinkSync(filePath);
      });
    });
    return;
  }

  // Generar ODT con pandoc-bin
  else if (format === "odt") {
    const markdownFilePath = path.join(__dirname, "temp.md");
    fs.writeFileSync(markdownFilePath, text);

    const command = `"${pandoc.path}" "${markdownFilePath}" -o "${filePath}" --from=markdown --to=odt`;

    exec(command, (err, stdout, stderr) => {
      if (err || stderr) {
        console.error("Error:", err || stderr);
        return res.status(500).send("Error generando el archivo ODT.");
      }
      res.download(filePath, filename, (err) => {
        if (err) console.error(err);
        fs.unlinkSync(markdownFilePath);
        fs.unlinkSync(filePath);
      });
    });
    return;
  }

  res.status(400).send("Formato inválido");
});

app.listen(PORT, () => {
  console.log(`Server corriendo en http://localhost:${PORT}`);
});