// This module handles displaying book choices and selection logic for borrowbook.js

let bookChoiceContainer = null;
let selectBookCallback = null;

export function setBookChoiceContainer(container) {
  bookChoiceContainer = container;
}

export function setSelectBookCallback(callback) {
  selectBookCallback = callback;
}

export function displayBookChoices(books) {
  if (!bookChoiceContainer) return;

  bookChoiceContainer.innerHTML = '';

  const heading = document.createElement('h4');
  heading.className = 'book-choices-heading';
  heading.textContent = `Found ${books.length} matching books:`;
  bookChoiceContainer.appendChild(heading);

  const choiceList = document.createElement('ul');
  choiceList.className = 'book-choices-list';

  books.forEach(book => {
    const choiceItem = document.createElement('li');
    choiceItem.className = 'book-choice-item';

    const coverImage = book.cover_image || '/images/default-book-cover.jpg';

    choiceItem.innerHTML = `
      <div class="book-choice-info">
        <img src="${coverImage}" alt="${book.title}" class="book-choice-cover">
        <div class="book-choice-details">
          <span class="book-choice-title">${book.title}</span>
          <span class="book-choice-author">by ${book.author}</span>
          <span class="book-choice-id">ID: ${book.id} | ISBN: ${book.isbn || 'N/A'}</span>
          <span class="book-choice-status ${book.status && book.status.toLowerCase() === 'available' ? 'available' : 'unavailable'}">
            ${book.status}
          </span>
        </div>
      </div>
      <button class="book-choice-select" data-book-id="${book.id}" 
        ${book.status && book.status.toLowerCase() !== 'available' ? 'disabled' : ''}>
        Select
      </button>
    `;

    choiceList.appendChild(choiceItem);

    const selectBtn = choiceItem.querySelector('.book-choice-select');
    selectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof selectBookCallback === 'function') {
        selectBookCallback(book);
      }
    });

    choiceItem.addEventListener('click', (e) => {
      if (!e.target.closest('.book-choice-select')) {
        if (book.status && book.status.toLowerCase() === 'available') {
          if (typeof selectBookCallback === 'function') {
            selectBookCallback(book);
          }
        }
      }
    });
  });

  bookChoiceContainer.appendChild(choiceList);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'book-choices-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    bookChoiceContainer.innerHTML = '';
  });

  bookChoiceContainer.appendChild(closeBtn);

  addBookChoicesStyles();
}

function addBookChoicesStyles() {
  if (!document.getElementById('book-choices-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'book-choices-styles';
    styleElement.textContent = `
      .book-choices-container {
        margin: 10px 0;
        padding: 0;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        position: relative;
      }
      .book-choices-heading {
        padding: 10px;
        margin: 0;
        background-color: #eee;
        border-bottom: 1px solid #ddd;
        font-size: 16px;
        color: #333;
      }
      .book-choices-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .book-choice-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 10px;
        border-bottom: 1px solid #eee;
        transition: background-color 0.2s;
        cursor: pointer;
      }
      .book-choice-item:hover {
        background-color: #f0f0f0;
      }
      .book-choice-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }
      .book-choice-cover {
        width: 60px;
        height: 80px;
        object-fit: cover;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        border-radius: 3px;
      }
      .book-choice-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .book-choice-title {
        font-weight: bold;
        font-size: 15px;
      }
      .book-choice-author {
        font-style: italic;
        color: #666;
      }
      .book-choice-id {
        font-size: 12px;
        color: #777;
      }
      .book-choice-status {
        font-size: 12px;
        font-weight: bold;
        padding: 2px 5px;
        border-radius: 3px;
        display: inline-block;
        margin-top: 3px;
      }
      .book-choice-status.available {
        background-color: #d4edda;
        color: #155724;
      }
      .book-choice-status.unavailable {
        background-color: #f8d7da;
        color: #721c24;
      }
      .book-choice-select {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        transition: background-color 0.2s;
        min-width: 70px;
      }
      .book-choice-select:hover {
        background-color: #0069d9;
      }
      .book-choice-select:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      .book-choices-close {
        display: block;
        width: 100%;
        padding: 8px;
        background-color: #f8f9fa;
        border: none;
        border-top: 1px solid #ddd;
        cursor: pointer;
        font-weight: bold;
        color: #495057;
      }
      .book-choices-close:hover {
        background-color: #e2e6ea;
      }
    `;
    document.head.appendChild(styleElement);
  }
}