# Add your PDF files here

This folder is where you should place all the PDF documents you want to process with your RAG system.

## Instructions

1. Copy or move your PDF files into this folder
2. Run `python 1_loading_pdfs.py` to extract text from the PDFs
3. The extracted data will be saved to `datasets/data.txt`

## Supported Files

- Any standard PDF file (.pdf extension)
- Text-based PDFs work best
- Scanned PDFs require OCR (see PDF_SETUP_GUIDE.md for OCR setup)

## Example Structure

```
pdfs/
├── research_paper_1.pdf
├── company_handbook.pdf
├── technical_documentation.pdf
└── meeting_notes.pdf
```

## Tips

- File names will be used as document titles if PDF metadata doesn't contain a title
- Keep file names descriptive for easier reference
- The system will process all PDF files in this folder automatically
