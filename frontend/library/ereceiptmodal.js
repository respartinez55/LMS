  let confirmBorrowCallback = null;

  export function setConfirmBorrowCallback(cb) {
    confirmBorrowCallback = cb;
  }

  export function fillReceiptData(data) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    document.getElementById('receiptDate').textContent = currentDate;
    document.getElementById('transactionId').textContent = data.transactionId;
    document.getElementById('receiptBookId').textContent = data.bookId;
    document.getElementById('receiptBookTitle').textContent = data.bookTitle;
    document.getElementById('receiptBorrowDate').textContent = formatDateForDisplay(data.borrowDate);
    document.getElementById('receiptReturnDate').textContent = formatDateForDisplay(data.returnDate);

    const receiptBarcode = document.getElementById('receiptBarcode');
    if (receiptBarcode) {
      // Show complete transaction ID including IS- prefix
      receiptBarcode.textContent = data.transactionId;
    }

    // Optional: If you want to show the book cover, add an <img id="receiptBookCover"> in your modal
    const bookCoverElem = document.getElementById('receiptBookCover');
    if (bookCoverElem && data.coverImage) {
      bookCoverElem.src = data.coverImage;
      bookCoverElem.alt = data.bookTitle;
    }
  }

  function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  export function showReceiptModal() {
    const modal = document.querySelector('#receiptModal');
    if (modal) {
      modal.style.display = 'block';
      modal.classList.add('show');
    }
    document.body.style.overflow = 'hidden';
  }

  export function closeReceiptModal() {
    const modal = document.querySelector('#receiptModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('show');
    }
    document.body.style.overflow = '';
  }

  export function createQRCode(transactionId, callback) {
    const qrContainer = document.querySelector('#qrcode');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      // Generate QR code as canvas
      const qr = new QRCode(qrContainer, {
        text: `LMSBORROWID:${transactionId}`,
        width: 128,
        height: 128,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });

      // Wait for QR code to render, then get the image data
      setTimeout(() => {
        // Try to get the canvas or img element
        let qrImg = qrContainer.querySelector('img');
        let qrCanvas = qrContainer.querySelector('canvas');
        let qrDataUrl = null;
        if (qrImg && qrImg.src) {
          qrDataUrl = qrImg.src;
        } else if (qrCanvas) {
          qrDataUrl = qrCanvas.toDataURL('image/png');
        }
        if (typeof callback === 'function') {
          callback(qrDataUrl);
        }
      }, 300); // Wait for QRCode to render
    } else if (typeof callback === 'function') {
      callback(null);
    }
  }

  export function downloadReceiptAsPDF() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      loadPDFLibraries(() => generatePDF());
    } else {
      generatePDF();
    }
  }

  function loadPDFLibraries(callback) {
    // Only load if not already loaded
    if (!window.jspdf) {
      const jspdfScript = document.createElement('script');
      jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      jspdfScript.onload = function() {
        if (!window.html2canvas) {
          const html2canvasScript = document.createElement('script');
          html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          html2canvasScript.onload = callback;
          document.head.appendChild(html2canvasScript);
        } else {
          callback();
        }
      };
      document.head.appendChild(jspdfScript);
    } else if (!window.html2canvas) {
      const html2canvasScript = document.createElement('script');
      html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      html2canvasScript.onload = callback;
      document.head.appendChild(html2canvasScript);
    } else {
      callback();
    }
  }

  function generatePDF() {
    // Try to find the complete receipt container first
    let receiptElement = document.querySelector('.modal-content .receipt');
    
    // If not found, try the main receipt element
    if (!receiptElement) {
      receiptElement = document.querySelector('.receipt');
    }
    
    // If still not found, try the entire modal content (excluding header/footer buttons)
    if (!receiptElement) {
      receiptElement = document.querySelector('#receiptModal .modal-content');
    }
    
    if (!receiptElement) {
      console.error('Receipt element not found for PDF generation');
      return;
    }

    // Temporarily hide modal footer and close button for clean PDF
    const modalFooter = document.querySelector('#receiptModal .modal-footer');
    const closeButton = document.querySelector('#receiptModal .close-modal');
    
    if (modalFooter) modalFooter.style.display = 'none';
    if (closeButton) closeButton.style.display = 'none';

    // Configure html2canvas options for better quality and complete capture
    const options = {
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: receiptElement.scrollWidth,
      height: receiptElement.scrollHeight,
      scrollX: 0,
      scrollY: 0
    };

    window.html2canvas(receiptElement, options).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      
      // Use window.jspdf.jsPDF for UMD build
      const jsPDFConstructor = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
      const pdf = new jsPDFConstructor('p', 'mm', 'a4');
      
      // Calculate dimensions to fit the page properly
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate the ratio to fit the content properly
      const ratio = Math.min(pdfWidth / (canvasWidth * 0.264583), pdfHeight / (canvasHeight * 0.264583));
      const imgWidth = canvasWidth * 0.264583 * ratio;
      const imgHeight = canvasHeight * 0.264583 * ratio;
      
      // Center the image on the page
      const x = (pdfWidth - imgWidth) / 2;
      const y = 10; // Small margin from top
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      
      const transactionId = document.getElementById('transactionId')?.textContent || 'receipt';
      pdf.save(`book-receipt-${transactionId}.pdf`);
      
      // Restore hidden elements
      if (modalFooter) modalFooter.style.display = '';
      if (closeButton) closeButton.style.display = '';
    }).catch(error => {
      console.error('Error generating PDF:', error);
      
      // Restore hidden elements in case of error
      if (modalFooter) modalFooter.style.display = '';
      if (closeButton) closeButton.style.display = '';
    });
  }

  export function setupReceiptModalEvents() {
    const closeModal = document.querySelector('.close-modal');
    const downloadReceiptBtn = document.querySelector('#downloadReceipt'); // Blue (Borrow)
    const printReceiptBtn = document.querySelector('#printReceipt'); // Purple (Download PDF)

    // Remove any previous listeners to avoid duplicate triggers
    if (closeModal) {
      closeModal.onclick = (e) => {
        e.preventDefault();
        closeReceiptModal();
        document.dispatchEvent(new CustomEvent('modal-closed'));
      };
    }

    // Purple button: Download PDF
    if (printReceiptBtn) {
      printReceiptBtn.onclick = (e) => {
        e.preventDefault();
        downloadReceiptAsPDF();
      };
    }

    // Blue button: Confirm Borrow
    if (downloadReceiptBtn) {
      downloadReceiptBtn.onclick = async (e) => {
        e.preventDefault();
        // Always set status to 'Pending' and include QR code image data
        const transactionId = document.getElementById('transactionId')?.textContent;
        createQRCode(transactionId, async (qrDataUrl) => {
          // Upload QR code image to backend and get filename
          let qrCodeFileName = null;
          if (qrDataUrl) {
            try {
              const uploadRes = await fetch('/api/borrow/upload-qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  qrBase64: qrDataUrl,
                  transactionId
                })
              });
              const uploadData = await uploadRes.json();
              if (uploadData.success && uploadData.fileName) {
                qrCodeFileName = uploadData.fileName;
              }
            } catch (err) {
              qrCodeFileName = null;
            }
          }
          // Always send status as 'Pending' to the event/callback
          if (typeof confirmBorrowCallback === 'function') {
            confirmBorrowCallback('Pending', qrCodeFileName);
          } else {
            document.dispatchEvent(new CustomEvent('confirm-borrow', { detail: { status: 'Pending', qr_code: qrCodeFileName } }));
          }
        });
      };
    }

    addReceiptModalStyles();
  }

  function addReceiptModalStyles() {
    if (!document.getElementById('ereceiptmodal-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'ereceiptmodal-styles';
      styleElement.textContent = `
        #receiptModal {
          display: none;
          position: fixed;
          z-index: 1050;
          left: 0;
          top: 0;
          width: 100vw;
          height: 100vh;
          overflow-y: auto;
          background: rgba(0, 0, 0, 0.5);
        }

        #receiptBorrowerDetailsValue,
        #receiptBorrowerDetailsValue * {
          font-weight: normal !important;
        }

        #receiptModal.show {
          display: block !important;
        }

        #receiptModal .modal-content {
          background: #fff;
          margin: 2vh auto;
          padding: 25px;
          border-radius: 8px;
          width: 550px;
          max-width: 90vw;
          max-height: 96vh;
          position: relative;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        #receiptModal .close-modal {
          position: absolute;
          top: 15px;
          right: 20px;
          font-size: 24px;
          font-weight: bold;
          color: #666;
          cursor: pointer;
          background: none;
          border: none;
        }

        #receiptModal .close-modal:hover {
          color: #dc3545;
        }

        .receipt {
          text-align: center;
          padding: 25px 0;
          width: 100%;
          max-width: 500px;
        }

        .receipt h2 {
          margin: 0 0 15px 0;
          color: #007bff;
        }

        .receipt-header {
          margin-bottom: 10px;
          margin-top: -2px;
        }

        .receipt-header h3 {
          color: #007bff;
          margin: 0 0 10px 0;
        }

        .receipt-header p {
          margin-top: 0px;
          font-size: 15px;
        }

        .receipt-qrcode {
          margin: 15px 0;
          padding: 30px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #dee2e6;
          width: 100%;
          box-sizing: border-box;
        }

        #qrcode {
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
        }

        #qrcode canvas,
        #qrcode img {
          border: 1px solid #000000;
          border-radius: 4px;
          height: 200px;
          width: 200px;
        }

        .receipt-details {
          text-align: left;
          margin: 25px 0;
          width: 100%;
          padding: 0 25px;
          box-sizing: border-box;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          gap: 30px;
        }

        .receipt-row:last-child {
          border-bottom: none;
        }

        .receipt-label {
          font-weight: 600;
          color: #555;
          flex-shrink: 0;
          min-width: 120px;
        }

        .receipt-value {
          color: #333;
          text-align: right;
          word-break: break-word;
        }

        .receipt-status {
          color: #28a745;
          font-weight: bold;
        }

        .receipt-book-cover {
          width: 80px;
          height: 110px;
          object-fit: cover;
          border-radius: 4px;
          margin: 15px auto 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .receipt-footer {
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
        }

        .receipt-footer p {
          margin: 0;
        }

        .modal-header {
          margin-bottom: -15px;
        }

        .modal-footer {
          margin-top: 15px;
          display: flex;
          gap: 10px;
          justify-content: center;
        }

        .modal-footer button {
          margin-top: -10px;
          border-radius: 6px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
        }

        .btn-primary {
          background: #007bff;
          color: #fff;
        }

        .btn-primary:hover {
          background: #0056b3;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: #6c757d;
          color: #fff;
        }

        .btn-secondary:hover {
          background: #545b62;
          transform: translateY(-1px);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          #receiptModal .modal-content {
            width: 95vw;
            margin: 1vh auto;
            max-height: 98vh;
            padding: 15px;
          }
          
          .receipt {
            padding: 15px 0;
          }
        }

        @media (max-width: 480px) {
          .modal-footer {
            flex-direction: column;
          }
          
          .modal-footer button {
            width: 100%;
          }
          
          .receipt-row {
            flex-direction: column;
            gap: 4px;
          }
          
          .receipt-label {
            font-size: 14px;
          }
        }

        /* Print Styles */
        @media print {
          #receiptModal {
            position: static !important;
            background: none !important;
          }
          
          #receiptModal .modal-content {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          
          .close-modal,
          .modal-footer {
            display: none !important;
          }
          
          .receipt {
            color: black !important;
            background: white !important;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
  }