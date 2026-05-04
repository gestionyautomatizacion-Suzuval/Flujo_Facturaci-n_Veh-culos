import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const inspectPDF = async (filePath) => {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    
    console.log(`Inspecting ${filePath}`);
    
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        console.log(`Page ${pageNum} size: width ${viewport.width}, height ${viewport.height}`);
        
        const textContent = await page.getTextContent();
        console.log(`\nText Elements on Page ${pageNum}:`);
        for (const item of textContent.items) {
            const str = item.str.trim();
            if (str.length > 0) {
                const x = item.transform[4];
                const y = item.transform[5];
                console.log(`Text: "${str}" | X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}`);
            }
        }
    }
};

inspectPDF('public/templates/pep_empresas_template.pdf').catch(console.error);
