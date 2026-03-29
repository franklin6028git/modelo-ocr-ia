
import { useState, useEffect } from 'react';
import Tesseract, { PSM } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

export default function App() {
  const [arquivo, setArquivo] = useState(null);
  const [template, setTemplate] = useState("");
  const [textoExtraido, setTextoExtraido] = useState("");
  const [output, setOutput] = useState("");

  const aplicarOCRImagem = async (file) => {
    const url = URL.createObjectURL(file);
    const { data } = await Tesseract.recognize(url, 'por', {
      tessedit_pageseg_mode: PSM.AUTO_OSD
    });
    return data.text;
  };

  const aplicarOCRCanvas = async (canvas) => {
    const { data } = await Tesseract.recognize(canvas, 'por', {
      tessedit_pageseg_mode: PSM.AUTO_OSD
    });
    return data.text;
  };

  const extractTextFromPDF = async (file) => {
    const arr = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
    let fulltext = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fulltext += content.items.map(i => i.str).join(' ') + '
';

      const ops = await page.getOperatorList();
      const imgs = [];

      for (let j = 0; j < ops.fnArray.length; j++) {
        if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) imgs.push(ops.argsArray[j][0]);
      }

      for (let img of imgs) {
        const image = await page.objs.get(img);
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(image, 0, 0);
        fulltext += await aplicarOCRCanvas(canvas);
      }
    }

    return fulltext;
  };

  const handleUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    let texto = "";

    if (f.type === 'application/pdf') texto = await extractTextFromPDF(f);
    else texto = await aplicarOCRImagem(f);

    setTextoExtraido(texto);
  };

  const IA_mapearCampo = (campo, texto) => {
    const padroes = {
      NOME: /nome[:\s]+([A-Za-zÀ-ÿ ]{5,})/i,
      CPF: /(\d{3}\.\d{3}\.\d{3}-\d{2})/,
      DATA: /(\d{1,2}\/\d{1,2}\/\d{4})/,
      ENDERECO: /endereço[:\s]+(.+?)(?:
|$)/i,
      RG: /(\d{2}\.\d{3}\.\d{3}-\d{1})/,
      TELEFONE: /\(?\d{2}\)?\s?9?\d{4}-\d{4}/,
      CEP: /(\d{5}-\d{3})/
    };

    if (padroes[campo]) {
      const achado = texto.match(padroes[campo]);
      return achado ? achado[1] : null;
    }
    return null;
  };

  const preencher = () => {
    const regex = /<<<(.*?)>>>/g;
    const resultado = template.replace(regex, (_, campo) => {
      const item = IA_mapearCampo(campo.trim().toUpperCase(), textoExtraido);
      return `<span style='color:red'>${item || campo}</span>`;
    });
    setOutput(resultado);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Sistema IA + OCR Local</h1>
      <input type="file" onChange={handleUpload} accept="application/pdf,image/jpeg,image/png" />
      <br/><br/>

      <textarea rows={6} style={{ width: '100%' }} value={template} onChange={e=>setTemplate(e.target.value)} placeholder="Ex: Nome: <<<NOME>>>" />

      <br/><br/>
      <button onClick={preencher}>Preencher</button>
      <br/><br/>

      <div dangerouslySetInnerHTML={{ __html: output }} />
    </div>
  );
}
