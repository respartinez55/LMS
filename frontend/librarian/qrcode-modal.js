import { API_BASE_URL, showNotification } from './dashboard.js';

const createQRModal = () => {
  if (document.getElementById('qrCodeModal')) {
    return;
  }

  const modalHTML = `
    <div id="qrCodeModal" class="modal">
      <div class="modal-content receipt">
        <div class="modal-header receipt-header">
          <h2>Book QR Code</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body receipt-details">
          <div class="qr-container receipt-barcode">
            <div id="modalQrCode"></div>
          </div>
          <div class="book-details">
            <h3 id="modal-book-title" class="receipt-label">Loading...</h3>
            <div class="book-detail-item receipt-row">
              <span class="receipt-label">Author:</span> <span id="modal-book-author" class="receipt-value">-</span>
            </div>
            <div class="book-detail-item receipt-row">
              <span class="receipt-label">ISBN:</span> <span id="modal-book-isbn" class="receipt-value">-</span>
            </div>
            <div class="book-detail-item receipt-row">
              <span class="receipt-label">Category:</span> <span id="modal-book-category" class="receipt-value">-</span>
            </div>
            <div class="book-detail-item receipt-row">
              <span class="receipt-label">Status:</span> <span id="modal-book-status" class="receipt-status">-</span>
            </div>
          </div>
        </div>
        <div class="modal-footer receipt-footer">
          <div class="notification-actions">
            <button id="printQrBtn" class="btn btn-outline action-link">
              <i class="fas fa-print"></i> Print QR Code
            </button>
            <button id="downloadQrBtn" class="btn btn-primary action-link primary">
              <i class="fas fa-download"></i> Download QR Code
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const modalElement = document.createElement('div');
  modalElement.innerHTML = modalHTML;
  document.body.appendChild(modalElement.firstElementChild);

  const styleElement = document.createElement('style');
  styleElement.textContent = `
    #qrCodeModal.modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
    }
    
    #qrCodeModal .modal-content {
      background-color: white;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      width: 400px;
      max-width: 90%;
      animation: modalFadeIn 0.3s;
      position: relative;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    
    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -60%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }
    
    #qrCodeModal .modal-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #ccc;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    #qrCodeModal .modal-header h2 {
      margin: 0;
      font-size: 1.3rem;
      color: #333;
    }
    
    #qrCodeModal .modal-body {
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    #qrCodeModal .qr-container {
      text-align: center;
      margin-bottom: 15px;
    }
    
    #qrCodeModal .book-details {
      width: 100%;
    }
    
    #qrCodeModal .book-detail-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      padding: 5px 0;
    }
    
    #qrCodeModal .receipt-label {
      font-weight: bold;
      color: #555;
    }
    
    #qrCodeModal .receipt-value {
      color: #333;
    }
    
    #qrCodeModal .receipt-status {
      color: #28a745;
      font-weight: bold;
    }
    
    #qrCodeModal .modal-footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed #ccc;
      color: #666;
    }
    
    #qrCodeModal .close-modal {
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      color: #777;
    }
    
    #qrCodeModal .close-modal:hover {
      color: #333;
    }
    
    #qrCodeModal .notification-actions {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      justify-content: center;
      width: 100%;
    }
    
    #qrCodeModal .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;
      border: none;
      font-size: 0.85rem;
      text-decoration: none;
      min-width: 130px;
      height: 40px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    #qrCodeModal .btn-outline {
      background-color: transparent;
      border: 1px solid #ddd;
      color: #555;
    }
    
    #qrCodeModal .btn-outline:hover {
      background-color: #f5f5f5;
    }
    
    #qrCodeModal .btn-primary {
      background-color: #1a73e8;
      color: white;
    }
    
    #qrCodeModal .btn-primary:hover {
      background-color: #1565c0;
    }
    
    #qrCodeModal #modal-book-title {
      text-align: center;
      margin: 0 0 15px 0;
      padding-bottom: 10px;
      font-size: 1.1rem;
      border-bottom: 1px dashed #ccc;
      width: 100%;
    }
    
    @media print {
      body * {
        visibility: hidden;
      }
      .modal-content, .modal-content * {
        visibility: visible;
      }
      .modal-content {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        border: none;
        box-shadow: none;
      }
      .modal-header, .modal-footer {
        display: none;
      }
    }
  `;
  document.head.appendChild(styleElement);

  const closeBtn = document.querySelector('.close-modal');
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
  createQRModal();
  
  const modal = document.getElementById('qrCodeModal');
  modal.style.display = 'block';
  
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
    }
  } catch (error) {
    console.error('Error in openQRModal:', error);
    showNotification('Failed to generate QR code', 'error');
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
          background-color: #1a73e8;
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
          background-color: #1565c0;
        }
        .close-button {
          padding: 10px 20px;
          font-size: 0.9rem;
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 8px;
          margin: 20px 5px;
          cursor: pointer;
          height: 40px;
          min-width: 110px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .close-button:hover {
          background-color: #e5e5e5;
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