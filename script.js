document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('pdf-files');
    const fileList = document.getElementById('file-list');
    const mergeBtn = document.getElementById('merge-btn');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadLink = document.getElementById('download-link');
    const navbar = document.getElementById('navbar');

    const splitFileInput = document.getElementById('split-file');
    const splitBtn = document.getElementById('split-btn');
    const splitList = document.getElementById('split-list');
    const splitFromInput = document.getElementById('split-from');
    const splitToInput = document.getElementById('split-to');
    const downloadAllBtn = document.getElementById('download-all-btn');

    let selectedFiles = [];

    let splitSelectedFile = null;

    fileInput.addEventListener('change', handleFileSelection);
    mergeBtn.addEventListener('click', mergePDFs);
    splitFileInput.addEventListener('change', handleSplitSelection);
    splitBtn.addEventListener('click', splitPDF);

    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');

    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.toggle('hidden', page.id !== pageId);
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            showPage(pageId);
        });
    });

    // default start on merge page
    showPage('merge-page');

    function handleFileSelection(e) {
        const files = Array.from(e.target.files);
        selectedFiles = files.filter(file => file.type === 'application/pdf');
        displayFiles();
        mergeBtn.disabled = selectedFiles.length < 2;
    }

    function displayFiles() {
        fileList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button class="remove-file" data-index="${index}">Remove</button>
            `;
            fileList.appendChild(fileItem);
        });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-file')) {
            const index = parseInt(e.target.dataset.index);
            if (!isNaN(index)) {
                selectedFiles.splice(index, 1);
                displayFiles();
                mergeBtn.disabled = selectedFiles.length < 2;
            } else if (e.target.dataset.section === 'split') {
                splitSelectedFile = null;
                displaySplitFile();
                splitBtn.disabled = true;
            } else if (e.target.dataset.section === 'compress') {
                compressSelectedFile = null;
                displayCompressFile();
                compressBtn.disabled = true;
            }
        }
    });
    }

    function displaySplitFile() {
        const display = document.getElementById('split-file-display');
        display.innerHTML = '';
        if (splitSelectedFile) {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <span>${splitSelectedFile.name} (${(splitSelectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button class="remove-file" data-section="split">Remove</button>
            `;
            display.appendChild(item);
            const removeBtn = item.querySelector('.remove-file');
            removeBtn.addEventListener('click', () => {
                splitSelectedFile = null;
                displaySplitFile();
                splitBtn.disabled = true;
            });
        }
    }

    function handleSplitSelection(e) {
        if (e.target.files.length === 1 && e.target.files[0].type === 'application/pdf') {
            splitSelectedFile = e.target.files[0];
            displaySplitFile();
            splitBtn.disabled = false;
        } else {
            splitSelectedFile = null;
            displaySplitFile();
            splitBtn.disabled = true;
        }
    }

    downloadAllBtn.addEventListener('click', async () => {
        if (!window.JSZip) {
            alert('JSZip is not loaded; cannot download zip.');
            return;
        }

        const zip = new JSZip();
        const anchors = splitList.querySelectorAll('a.download-link');
        if (!anchors.length) {
            alert('No split parts available to download.');
            return;
        }

        for (let a of anchors) {
            const resp = await fetch(a.href);
            const blob = await resp.blob();
            zip.file(a.download, blob);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const tmp = document.createElement('a');
        tmp.href = url;
        tmp.download = 'split-files.zip';
        tmp.click();
        URL.revokeObjectURL(url);
    });

    function handleCompressSelection(e) {
        if (e.target.files.length === 1 && e.target.files[0].type === 'application/pdf') {
            compressSelectedFile = e.target.files[0];
            displayCompressFile();
            compressBtn.disabled = false;
        } else {
            compressSelectedFile = null;
            displayCompressFile();
            compressBtn.disabled = true;
        }
    }

    async function splitPDF() {
        const file = splitSelectedFile;
        if (!file) return;

        let from = parseInt(document.getElementById('split-from').value, 10);
        let to = parseInt(document.getElementById('split-to').value, 10);

        splitBtn.disabled = true;
        splitList.innerHTML = '<p>Splitting PDF...</p>';
        downloadAllBtn.classList.add('hidden');

        try {
            const buffer = await file.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(buffer);
            const total = pdfDoc.getPageCount();

            if (isNaN(from) || from < 1) from = 1;
            if (isNaN(to) || to < from) to = total;
            if (to > total) to = total;

            if (from > total) {
                splitList.innerHTML = '<p>Start page exceeds total page count.</p>';
                return;
            }

            splitList.innerHTML = '';
            for (let i = from - 1; i < to; i++) {
                const splitDoc = await PDFLib.PDFDocument.create();
                const [page] = await splitDoc.copyPages(pdfDoc, [i]);
                splitDoc.addPage(page);

                const splitBytes = await splitDoc.save();
                const blob = new Blob([splitBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `${file.name.replace(/\.pdf$/i, '')}-page-${i + 1}.pdf`;
                link.textContent = `Download page ${i + 1}`;
                link.className = 'download-link';

                const item = document.createElement('div');
                item.classList.add('file-item');
                item.appendChild(link);
                splitList.appendChild(item);
            }

            splitList.insertAdjacentHTML('afterbegin', `<p>Split pages ${from}–${to} (${to - from + 1} files).</p>`);
            downloadAllBtn.classList.remove('hidden');

        } catch (err) {
            console.error('Split error', err);
            splitList.innerHTML = '<p>Error splitting PDF.</p>';
        } finally {
            splitBtn.disabled = false;
        }
    }

    async function mergePDFs() {
        if (selectedFiles.length < 2) return;

        mergeBtn.disabled = true;
        progress.classList.remove('hidden');
        downloadLink.classList.add('hidden');

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                progressText.textContent = `Processing ${file.name}...`;
                progressFill.style.width = `${((i + 0.5) / selectedFiles.length) * 100}%`;

                const fileBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(fileBuffer);

                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }

            progressText.textContent = 'Finalizing merged PDF...';
            progressFill.style.width = '100%';

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            downloadLink.href = url;
            downloadLink.classList.remove('hidden');
            progressText.textContent = 'Merge complete!';

        } catch (error) {
            console.error('Error merging PDFs:', error);
            progressText.textContent = 'Error merging PDFs. Please try again.';
        } finally {
            mergeBtn.disabled = false;
        }
    }
});