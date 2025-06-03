// This module handles displaying book choices and selection logic for reservations

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
    const isAvailable = book.status && book.status.toLowerCase() === 'available' && book.available_quantity > 0;
    
    // Calculate earliest return date if not available
    let availabilityInfo = '';
    if (!isAvailable) {
      if (book.earliest_return_date) {
        const returnDate = new Date(book.earliest_return_date);
        const today = new Date();
        const daysUntilAvailable = Math.ceil((returnDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilAvailable > 0) {
          availabilityInfo = `Expected available: ${returnDate.toLocaleDateString()} (${daysUntilAvailable} days)`;
        } else {
          availabilityInfo = 'May be available soon (check with librarian)';
        }
      } else {
        availabilityInfo = 'All copies currently borrowed';
      }
    }

    choiceItem.innerHTML = `
      <div class="book-choice-info">
        <img src="${coverImage}" alt="${book.title}" class="book-choice-cover">
        <div class="book-choice-details">
          <span class="book-choice-title">${book.title}</span>
          <span class="book-choice-author">by ${book.author}</span>
          <span class="book-choice-id">ID: ${book.id} | ISBN: ${book.isbn || 'N/A'}</span>
          <span class="book-choice-availability">
            Available: ${book.available_quantity || 0} of ${book.quantity || 1} copies
          </span>
          <span class="book-choice-status ${isAvailable ? 'available' : 'unavailable'}">
            ${isAvailable ? 'Available' : 'Not Available'}
          </span>
          ${!isAvailable && availabilityInfo ? `<span class="book-availability-info">${availabilityInfo}</span>` : ''}
        </div>
      </div>
      <div class="book-choice-actions">
        ${isAvailable ? 
          `<button class="book-choice-borrow" data-book-id="${book.id}" data-action="borrow">
            Borrow Now
          </button>` : ''
        }
        <button class="book-choice-reserve" data-book-id="${book.id}" data-action="reserve"
          ${book.status && book.status.toLowerCase() === 'unavailable' ? 'disabled' : ''}>
          ${isAvailable ? 'Reserve' : 'Join Waitlist'}
        </button>
      </div>
    `;

    choiceList.appendChild(choiceItem);

    // Add event listeners for both borrow and reserve buttons
    const borrowBtn = choiceItem.querySelector('.book-choice-borrow');
    const reserveBtn = choiceItem.querySelector('.book-choice-reserve');

    if (borrowBtn) {
      borrowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof selectBookCallback === 'function') {
          selectBookCallback(book, 'borrow');
        }
      });
    }

    if (reserveBtn && !reserveBtn.disabled) {
      reserveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof selectBookCallback === 'function') {
          selectBookCallback(book, 'reserve');
        }
      });
    }

    // Click on item to reserve (if not clicking on buttons)
    choiceItem.addEventListener('click', (e) => {
      if (!e.target.closest('.book-choice-borrow') && !e.target.closest('.book-choice-reserve')) {
        if (typeof selectBookCallback === 'function') {
          const action = isAvailable ? 'borrow' : 'reserve';
          selectBookCallback(book, action);
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
      .book-choice-availability {
        font-size: 13px;
        color: #555;
        font-weight: 500;
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
      .book-availability-info {
        font-size: 11px;
        color: #e67e22;
        background-color: #fff3cd;
        padding: 2px 5px;
        border-radius: 3px;
        display: inline-block;
        margin-top: 3px;
        font-weight: 500;
      }
      .book-choice-actions {
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: flex-end;
      }
      .book-choice-borrow {
        background-color: #28a745;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        transition: background-color 0.2s;
        min-width: 70px;
        font-size: 12px;
      }
      .book-choice-borrow:hover {
        background-color: #218838;
      }
      .book-choice-reserve {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        transition: background-color 0.2s;
        min-width: 70px;
        font-size: 12px;
      }
      .book-choice-reserve:hover {
        background-color: #0069d9;
      }
      .book-choice-reserve:disabled {
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

// Additional utility function to fetch book availability from the API
export async function fetchBookAvailability(bookId) {
  try {
    const response = await fetch(`/api/borrow/${bookId}?status=Borrowed&limit=10`);
    if (!response.ok) throw new Error('Failed to fetch book availability');
    
    const data = await response.json();
    if (data.success && data.borrowings) {
      // Find the earliest expected return date
      const activeBorrowings = data.borrowings.filter(b => b.status === 'Borrowed');
      if (activeBorrowings.length > 0) {
        const earliestDueDate = activeBorrowings
          .map(b => new Date(b.dueDate))
          .sort((a, b) => a - b)[0];
        
        return {
          isAvailable: data.bookInfo.availableQuantity > 0,
          availableQuantity: data.bookInfo.availableQuantity,
          totalQuantity: data.bookInfo.totalQuantity,
          earliestReturnDate: earliestDueDate.toISOString().split('T')[0]
        };
      }
    }
    
    return {
      isAvailable: true,
      availableQuantity: 1,
      totalQuantity: 1,
      earliestReturnDate: null
    };
  } catch (error) {
    console.error('Error fetching book availability:', error);
    return {
      isAvailable: false,
      availableQuantity: 0,
      totalQuantity: 1,
      earliestReturnDate: null
    };
  }
}

// Function to enhance book data with availability information
export async function enhanceBooksWithAvailability(books) {
  const enhancedBooks = await Promise.all(
    books.map(async (book) => {
      const availability = await fetchBookAvailability(book.id);
      return {
        ...book,
        available_quantity: availability.availableQuantity,
        earliest_return_date: availability.earliestReturnDate,
        status: availability.isAvailable ? 'available' : 'unavailable'
      };
    })
  );
  
  return enhancedBooks;
}