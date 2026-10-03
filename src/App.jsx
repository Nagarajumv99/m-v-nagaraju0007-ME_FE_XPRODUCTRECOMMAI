import { useEffect, useState } from 'react'
import productQuestions from './aiData/sampleData.json'
import productRecommendations from './aiData/sampleProductData.json'
import botImage from './assets/bot.png'
import newChatImage from './assets/newchat.png'
import personImage from './assets/person.png'
import './App.css'

const HISTORY_KEY = 'product-recommendation-history'
const ACTIVE_KEY = 'product-recommendation-active'
const THEME_KEY = 'product-recommendation-theme'
const FALLBACK = 'Sorry, I did not understand your query!'

function newConversation() {
  return {
    id: crypto.randomUUID(),
    title: 'New recommendation',
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Hi there! I can help you find something you’ll love. What are you shopping for today?',
      },
    ],
    stage: 'product',
    product: '',
    rating: 0,
    feedback: '',
    saved: false,
  }
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function cleanRange(value) {
  return value.replace(/[₹,$]/g, '').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseSuggestions(entry) {
  return entry.response.slice(1).map((suggestion) => {
    const [name, url] = suggestion.split(', Link: ')
    return { name, url }
  })
}

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
    thumbUp: <><path d="M7 10v12M15 5l-1 5h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2l5-8a2 2 0 0 1 3 3Z" /></>,
    thumbDown: <><path d="M7 14V2M15 19l-1-5h6a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2l5 8a2 2 0 0 0 3-3Z" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [theme, setTheme] = useState(() => readStorage(THEME_KEY, 'light'))
  const [history, setHistory] = useState(() => readStorage(HISTORY_KEY, []))
  const [conversation, setConversation] = useState(() => readStorage(ACTIVE_KEY, null) || newConversation())
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [feedbackDrafts, setFeedbackDrafts] = useState({})
  const [showFinalFeedback, setShowFinalFeedback] = useState(false)
  const [feedbackTarget, setFeedbackTarget] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(conversation))
  }, [conversation])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname)
      setSelectedHistory(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    setSelectedHistory(null)
  }

  function appendMessage(role, text, suggestions = []) {
    return { id: crypto.randomUUID(), role, text, suggestions, createdAt: new Date().toISOString() }
  }

  function processQuery(input) {
    const text = input.trim()
    if (!text) return

    const userMessage = appendMessage('user', text)
    const priorMessages = conversation.stage === 'product' && conversation.messages.length === 1 && conversation.messages[0].role === 'assistant' ? [] : conversation.messages
    let nextMessages = [...priorMessages, userMessage]
    let nextConversation = { ...conversation, messages: nextMessages }

    if (conversation.stage === 'product') {
      const product = productQuestions.find((item) => text.toLowerCase().includes(item.question.toLowerCase()))
      if (!product) {
        nextMessages = [...nextMessages, appendMessage('assistant', FALLBACK)]
      } else {
        nextMessages = [...nextMessages, appendMessage('assistant', product.response)]
        nextConversation = { ...nextConversation, title: product.question, product: product.question, stage: 'range' }
      }
    } else if (conversation.stage === 'range') {
      const recommendation = productRecommendations.find((item) => {
        const [product, ...rangeParts] = item.question.split(' ')
        return product.toLowerCase() === conversation.product.toLowerCase() && cleanRange(rangeParts.join(' ')) === cleanRange(text)
      })
      if (!recommendation) {
        nextMessages = [...nextMessages, appendMessage('assistant', FALLBACK)]
      } else {
        const suggestionMessages = parseSuggestions(recommendation).map(({ name, url }) => appendMessage('assistant', '', [{ name, url }]))
        nextMessages = [...nextMessages, appendMessage('assistant', recommendation.response[0]), ...suggestionMessages]
        nextConversation = { ...nextConversation, stage: 'complete' }
      }
    } else {
      nextMessages = [...nextMessages, appendMessage('assistant', 'Your recommendations are ready. Start a new suggestion whenever you’re ready.')]
    }

    nextConversation = { ...nextConversation, messages: nextMessages }
    setConversation(nextConversation)
    setQuery('')
  }

  function submitQuery(event) {
    event.preventDefault()
    processQuery(query)
  }

  function updateMessage(messageId, updates) {
    setConversation((current) => ({
      ...current,
      messages: current.messages.map((message) => message.id === messageId ? { ...message, ...updates } : message),
    }))
  }

  function saveConversation(conversationToSave = conversation) {
    const saved = { ...conversationToSave, saved: true }
    setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
    if (saved.id === conversation.id) setConversation(saved)
  }

  function startNewSuggestion() {
    if (conversation.messages.length > 1) saveConversation()
    setConversation(newConversation())
    setShowFinalFeedback(false)
    setFeedbackTarget(null)
    setFeedbackDrafts({})
    setSidebarOpen(false)
    if (path === '/history') navigate('/')
  }

  function submitReplyFeedback(event, messageId, vote) {
    event.preventDefault()
    const feedback = feedbackDrafts[messageId] || ''
    const rating = new FormData(event.currentTarget).get('rating')
    updateMessage(messageId, { vote, feedback, replyRating: Number(rating) || 0, feedbackSubmitted: true })
    setFeedbackDrafts((current) => ({ ...current, [messageId]: '' }))
    setFeedbackTarget(null)
  }

  function handleReplyVote(messageId, vote) {
    updateMessage(messageId, { vote, feedback: '', replyRating: 0, feedbackSubmitted: false })
    if (vote === 'down') setFeedbackTarget(messageId)
  }

  function handleReplyRating(messageId, rating) {
    updateMessage(messageId, { vote: 'up', replyRating: rating, feedbackSubmitted: true })
  }

  function submitFinalFeedback(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const completed = {
      ...conversation,
      rating: Number(form.get('rating')) || 0,
      feedback: String(form.get('feedback') || '').trim(),
      completedAt: new Date().toISOString(),
    }
    saveConversation(completed)
    setConversation({ ...completed, saved: true })
    setShowFinalFeedback(false)
  }

  const isHistory = path === '/history'
  const visibleHistory = history.filter((item) => filter === 'all' || String(item.rating) === filter)
  const activeHistory = selectedHistory || visibleHistory[0] || null
  const isWelcome = conversation.stage === 'product' && conversation.messages.length === 1

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`app-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-heading">
          <img src={newChatImage} alt="" />
          <button className="sidebar-new-chat" type="button" onClick={startNewSuggestion}>Want new<br />suggestion?</button>
          <button className="sidebar-add" type="button" aria-label="Want new suggestion?" onClick={startNewSuggestion}><Icon name="plus" size={18} /></button>
        </div>
        <button className={`sidebar-history ${isHistory ? 'active' : ''}`} type="button" onClick={() => { navigate(isHistory ? '/' : '/history'); setSidebarOpen(false) }}>Previous Suggestions</button>
      </aside>
      {sidebarOpen && <button className="drawer-backdrop" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="app-header">
          <button className="menu-toggle" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={22} /></button>
          <h1>Product Recommendation AI</h1>
          <div className="theme-control"><span>{theme === 'light' ? 'Light' : 'Dark'}</span><button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><Icon name={theme === 'light' ? 'sun' : 'moon'} size={21} /></button></div>
        </header>

        {isHistory ? (
          <main className="history-view">
            <h2>Previous Suggestions</h2>
            <div className="history-toolbar"><label htmlFor="rating-filter">Filter by rating</label><select id="rating-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setSelectedHistory(null) }}><option value="all">All Ratings</option><option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option><option value="0">Not Rated</option></select></div>
            <h3>Today&apos;s chats</h3>
            {visibleHistory.length > 1 && <div className="history-picks">{visibleHistory.map((item) => <button key={item.id} className={activeHistory?.id === item.id ? 'selected' : ''} type="button" onClick={() => setSelectedHistory(item)}>{item.title || 'New suggestion'} <span>{item.rating ? `${item.rating}/5` : ''}</span></button>)}</div>}
            {activeHistory ? <ConversationMessages conversation={activeHistory} /> : <p className="history-empty">No saved suggestions yet.</p>}
          </main>
        ) : (
          <main className="chat-view" aria-label="Chat with product recommendation assistant">
            <section className={`chat-feed ${isWelcome ? 'welcome-feed' : ''}`}>
              {isWelcome ? <div className="welcome-view">
                <div className="welcome-intro"><h2>Hi, Please tell me what you want?</h2><img src={botImage} alt="Product recommendation chatbot" /></div>
                <div className="product-grid">{['Jeans', 'Smartphone', 'Laptop', 'T-Shirt'].map((product) => <button className="product-tile" key={product} type="button" onClick={() => processQuery(product)}><strong>{product}</strong><span>Get immediate AI generated response</span></button>)}</div>
              </div> : <ConversationMessages conversation={conversation} onVote={handleReplyVote} onReplyRating={handleReplyRating} />}
            </section>

            {conversation.stage === 'complete' && <button className="final-rating-trigger" type="button" onClick={() => setShowFinalFeedback(true)}>Rate this conversation</button>}

            <div className="composer-dock">
              <form className="chat-composer" onSubmit={submitQuery}>
                <label className="sr-only" htmlFor="chat-input">Your product query</label>
                <input id="chat-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Please tell me about your query!" autoComplete="off" />
                <button className="ask-button" type="submit">Ask</button>
              </form>
              <form className="save-form" onSubmit={(event) => { event.preventDefault(); saveConversation() }}><button className="save-button" type="submit" disabled={isWelcome}>Save</button></form>
            </div>
          </main>
        )}
      </div>

      {feedbackTarget && <div className="feedback-scrim" role="presentation" onClick={() => setFeedbackTarget(null)}><form className="feedback-modal" onSubmit={(event) => submitReplyFeedback(event, feedbackTarget, 'down')} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><span className="feedback-symbol">!</span><h2>Provide Additional Feedback</h2><button type="button" aria-label="Close feedback" onClick={() => setFeedbackTarget(null)}><Icon name="close" size={20} /></button></div><label className="sr-only" htmlFor="reply-feedback">Additional feedback</label><textarea id="reply-feedback" value={feedbackDrafts[feedbackTarget] || ''} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [feedbackTarget]: event.target.value }))} /><button className="modal-submit" type="submit">Submit</button></form></div>}

      {showFinalFeedback && <div className="feedback-scrim" role="presentation" onClick={() => setShowFinalFeedback(false)}><form className="feedback-modal final-modal" onSubmit={submitFinalFeedback} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><span className="feedback-symbol">!</span><h2>Rate this conversation</h2><button type="button" aria-label="Close feedback" onClick={() => setShowFinalFeedback(false)}><Icon name="close" size={20} /></button></div><div className="star-rating" role="radiogroup" aria-label="Rate this conversation out of five">{[1, 2, 3, 4, 5].map((rating) => <label key={rating}><input type="radio" name="rating" value={rating} required /><span aria-label={`${rating} stars`}>★</span></label>)}</div><label className="feedback-label" htmlFor="final-feedback-text">Additional feedback</label><textarea id="final-feedback-text" name="feedback" placeholder="Share your thoughts" defaultValue={conversation.feedback} /><button className="modal-submit" type="submit">Submit</button></form></div>}
    </div>
  )
}

function ConversationMessages({ conversation, onVote, onReplyRating }) {
  return (
    <div className="message-stack" aria-live="polite">
      {conversation.messages.map((message) => <article key={message.id} className={`message-card ${message.role}`}>
        <img className={message.role === 'user' ? 'message-avatar user' : 'message-avatar'} src={message.role === 'user' ? personImage : botImage} alt="" />
        <div className="message-body">
          <strong className="message-author">{message.role === 'user' ? 'You' : 'Product Recommendation AI'}</strong>
          {message.text && <p className="message-text">{message.text}</p>}
          {message.suggestions?.map((suggestion) => <a className="plain-suggestion" key={suggestion.name} href={suggestion.url} target="_blank" rel="noreferrer">{suggestion.name}, Link: {suggestion.url}</a>)}
          <time className="message-time">{new Date(message.createdAt || conversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          {message.role === 'assistant' && onVote && <div className="reply-feedback">
            {!message.vote && <div className="vote-controls"><button type="button" aria-label="Thumbs up" title="Helpful" onClick={() => onVote(message.id, 'up')}><Icon name="thumbUp" size={16} /></button><button type="button" aria-label="Thumbs down" title="Not helpful" onClick={() => onVote(message.id, 'down')}><Icon name="thumbDown" size={16} /></button></div>}
            {message.vote === 'up' && <div className="reply-rating"><span>Rate this response:</span><div className="star-rating">{[1, 2, 3, 4, 5].map((rating) => <label className={message.replyRating >= rating ? 'filled' : ''} key={rating}><input type="radio" name={`reply-rating-${message.id}`} value={rating} checked={message.replyRating === rating} onChange={() => onReplyRating(message.id, rating)} /><span aria-label={`${rating} stars`}>★</span></label>)}</div></div>}
            {message.vote === 'down' && message.feedbackSubmitted && <p className="feedback-thanks">Thanks for the feedback.</p>}
            {message.feedback && <p className="saved-feedback">{message.feedback}</p>}
          </div>}
        </div>
      </article>)}
    </div>
  )
}

export default App
