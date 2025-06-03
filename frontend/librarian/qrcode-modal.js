import { API_BASE_URL, showNotification } from './dashboard.js';

const createQRModal = () => {
  if (document.getElementById('qrCodeModal')) {
    return;
  }

  const modalHTML = `
    <div id="qrCodeModal" class="modal">
      <div class="modal-content">
        <button class="close-modal">&times;</button>
        <div class="receipt">
          <div class="receipt-header">
            <h2>BOOK QR CODE</h2>
          </div>
          
          <div class="receipt-qrcode">
            <div id="qrcode">
              <div id="modalQrCode"></div>
            </div>
            <h3 id="modal-book-title">Loading...</h3>
          </div>
          
          <div class="receipt-details">
            <div class="receipt-row">
              <span class="receipt-label">Author:</span>
              <span id="modal-book-author" class="receipt-value">-</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">ISBN:</span>
              <span id="modal-book-isbn" class="receipt-value">-</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Category:</span>
              <span id="modal-book-category" class="receipt-value">-</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Status:</span>
              <span id="modal-book-status" class="receipt-status">-</span>
            </div>
          </div>
          
          <div class="receipt-footer">
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div class="modal-footer">
          <button id="printQrBtn" class="btn-secondary">
            <i class="fas fa-print"></i> Print QR Code
          </button>
          <button id="downloadQrBtn" class="btn-primary">
            <i class="fas fa-download"></i> Download QR Code
          </button>
        </div>
      </div>
    </div>
  `;

  const modalElement = document.createElement('div');
  modalElement.innerHTML = modalHTML;
  document.body.appendChild(modalElement.firstElementChild);

  const styleElement = document.createElement('style');
  styleElement.textContent = `
    #qrCodeModal {
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

    #qrCodeModal.show {
      display: block !important;
    }

    #qrCodeModal .modal-content {
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

    #qrCodeModal .close-modal {
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

    #qrCodeModal .close-modal:hover {
      color: #dc3545;
    }

    .receipt {
      text-align: center;
      padding: 25px 0;
      width: 90%;
      max-width: 500px;
    }

    .receipt h2 {
      margin: 0 0 15px 0;
      color:rgb(0, 0, 0);
    }

    .receipt-header {
      margin-bottom: 7px;
      margin-top: -30px;
    }

    .receipt-header h3 {
      color:rgb(0, 0, 0);
      margin: 0 0 10px 0;
      margin-top: 100px;
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

    .receipt-qrcode p {
      margin-top: 15px;
      margin-bottom: 0;
      font-size: 15px;
      color: #666;
    }

    #modal-book-title {
      margin-top: 10px;
      margin-bottom: 0;
    }

    #qrcode {
      display: flex;
      justify-content: center;
      margin-bottom: 0;
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
      padding: 10px 16px;
      min-width: 130px;
      height: 40px;
      font-size: 0.85rem;
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
      #qrCodeModal .modal-content {
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
      #qrCodeModal {
        position: static !important;
        background: none !important;
      }
      
      #qrCodeModal .modal-content {
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

  const closeBtn = document.querySelector('#qrCodeModal .close-modal');
  const modal = document.getElementById('qrCodeModal');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  document.getElementById('printQrBtn').addEventListener('click', printQRCode);
  document.getElementById('downloadQrBtn').addEventListener('click', downloadQRCode);
};

const fetchBookData = async (bookId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/books/${bookId}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "include"
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Failed to fetch book data");
    }
    
    return data.book;
  } catch (error) {
    console.error('Error fetching book data:', error);
    showNotification(`Error: ${error.message}`, 'error');
    return null;
  }
};

const generateQRCode = (bookData) => {
  const qrContainer = document.getElementById('modalQrCode');
  qrContainer.innerHTML = '';

  // Create book viewer URL that includes the base URL of your application
  const baseUrl = window.location.origin;
  const bookViewerUrl = `${baseUrl}/book-viewer.html?id=${bookData.id}`;

  if (typeof QRCode === 'undefined') {
    loadQRCodeScript().then(() => {
      createQRCodeInstance(qrContainer, bookViewerUrl);
      updateBookDetails(bookData);
    }).catch(error => {
      showNotification("Failed to load QR Code library", "error");
      console.error("QR Code library loading error:", error);
    });
  } else {
    createQRCodeInstance(qrContainer, bookViewerUrl);
    updateBookDetails(bookData);
  }
};

const createQRCodeInstance = (container, data) => {
  new QRCode(container, {
    text: data,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
};

const loadQRCodeScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof QRCode !== 'undefined') {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const updateBookDetails = (bookData) => {
  document.getElementById('modal-book-title').textContent = bookData.title;
  document.getElementById('modal-book-author').textContent = bookData.author;
  document.getElementById('modal-book-isbn').textContent = bookData.isbn || 'N/A';
  document.getElementById('modal-book-category').textContent = bookData.category;
  
  let bookStatus = 'Available';
  if (bookData.borrowing_status) {
    bookStatus = bookData.borrowing_status.charAt(0).toUpperCase() + bookData.borrowing_status.slice(1);
  } else if (bookData.status) {
    bookStatus = bookData.status;
  }
  
  document.getElementById('modal-book-status').textContent = bookStatus;
};

const openQRModal = async (bookId) => {
  // Add validation for bookId
  if (!bookId) {
    console.error('Invalid book ID provided:', bookId);
    return;
  }

  createQRModal();
  
  const modal = document.getElementById('qrCodeModal');
  modal.style.display = 'block';
  
  // Reset modal content to loading state
  document.getElementById('modal-book-title').textContent = 'Loading...';
  document.getElementById('modal-book-author').textContent = '-';
  document.getElementById('modal-book-isbn').textContent = '-';
  document.getElementById('modal-book-category').textContent = '-';
  document.getElementById('modal-book-status').textContent = '-';
  
  try {
    await loadQRCodeScript();
    const bookData = await fetchBookData(bookId);
    if (bookData) {
      generateQRCode(bookData);
    } else {
      // Close modal if no book data is returned
      modal.style.display = 'none';
    }
  } catch (error) {
    console.error('Error in openQRModal:', error);
    showNotification('Failed to generate QR code', 'error');
    // Close modal on error
    modal.style.display = 'none';
  }
};

const printQRCode = () => {
  const qrCodeImg = document.querySelector('#modalQrCode img');
  const bookTitle = document.getElementById('modal-book-title').textContent;
  
  if (!qrCodeImg) {
    showNotification('No QR code to print', 'error');
    return;
  }
  
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print QR Code - ${bookTitle}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 20px;
        }
        .qr-container {
          margin: 20px auto;
        }
        .book-info {
          margin-bottom: 20px;
        }
        .receipt {
          background-color: white;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          margin: 0 auto;
        }
        .receipt-header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #ccc;
        }
        .receipt-details {
          margin-bottom: 20px;
        }
        .receipt-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 5px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .receipt-row:last-child {
          border-bottom: none;
        }
        .receipt-label {
          font-weight: bold;
          color: #555;
        }
        .receipt-barcode {
          margin-top: 15px;
          text-align: center;
        }
        .receipt-date {
          font-style: italic;
          color: #777;
          margin-top: 10px;
        }
        .print-button {
          padding: 10px 20px;
          font-size: 0.9rem;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          margin: 20px 5px;
          cursor: pointer;
          height: 40px;
          min-width: 110px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .print-button:hover {
          background-color: #0056b3;
        }
        .close-button {
          padding: 10px 20px;
          font-size: 0.9rem;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          margin: 20px 5px;
          cursor: pointer;
          height: 40px;
          min-width: 110px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .close-button:hover {
          background-color: #545b62;
        }
        @media print {
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-header">
          <h2>${bookTitle}</h2>
          <p class="receipt-date">Date: ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="receipt-details">
          <div class="receipt-row">
            <span class="receipt-label">ISBN:</span>
            <span>${document.getElementById('modal-book-isbn').textContent}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Author:</span>
            <span>${document.getElementById('modal-book-author').textContent}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Status:</span>
            <span>${document.getElementById('modal-book-status').textContent}</span>
          </div>
        </div>
        <div class="receipt-barcode">
          <img src="${qrCodeImg.src}" alt="QR Code">
          <p>Scan this QR code for book details</p>
        </div>
      </div>
      <div class="no-print">
        <button onclick="window.print()" class="print-button">Print</button>
        <button onclick="window.close()" class="close-button">Close</button>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
};

const downloadQRCode = () => {
  const qrCodeImg = document.querySelector('#modalQrCode img');
  const bookTitle = document.getElementById('modal-book-title').textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  if (!qrCodeImg) {
    showNotification('No QR code to download', 'error');
    return;
  }
  
  const downloadLink = document.createElement('a');
  downloadLink.href = qrCodeImg.src;
  downloadLink.download = `qrcode_${bookTitle}.png`;
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  
  showNotification('QR code downloaded successfully', 'success');
};

export {
  createQRModal,
  openQRModal,
  fetchBookData,
  generateQRCode
};