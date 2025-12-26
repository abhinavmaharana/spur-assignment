<script lang="ts">
	import { onMount } from 'svelte';

	interface Message {
		id: string;
		sender: 'user' | 'ai';
		text: string;
		timestamp: Date;
		reaction?: 'thumbs_up' | 'thumbs_down' | null;
	}

	let messages: Message[] = $state([]);
	let inputMessage: string = $state('');
	let sessionId: string | null = $state(null);
	let isLoading: boolean = $state(false);
	let error: string | null = $state(null);
	let messagesEndRef: HTMLDivElement;

	// Use environment variable for API URL, fallback to localhost for development
	const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:4000';
	const API_URL = `${API_BASE_URL}/chat/message`;
	const REQUEST_TIMEOUT_MS = 35000; // 35 seconds (slightly longer than backend timeout)

	async function loadConversationHistory(sessionIdToLoad: string) {
		try {
			const response = await fetch(`${API_BASE_URL}/chat/history/${sessionIdToLoad}`);
			
			if (response.ok) {
				const data = await response.json();
				messages = data.messages.map((msg: any) => ({
					id: msg.id,
					sender: msg.sender as 'user' | 'ai',
					text: msg.text,
					timestamp: new Date(msg.timestamp),
					reaction: msg.reaction || null,
				}));
				scrollToBottom();
			}
		} catch (err) {
			console.warn('Failed to load conversation history:', err);
			// Continue without history - not critical
		}
	}

	async function toggleReaction(messageId: string, reaction: 'thumbs_up' | 'thumbs_down' | null) {
		try {
			const currentMessage = messages.find(m => m.id === messageId);
			const newReaction = currentMessage?.reaction === reaction ? null : reaction;

			const response = await fetch(`${API_BASE_URL}/chat/message/${messageId}/reaction`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ reaction: newReaction }),
			});

			if (response.ok) {
				// Update local state
				messages = messages.map(msg => 
					msg.id === messageId ? { ...msg, reaction: newReaction } : msg
				);
			}
		} catch (err) {
			console.error('Failed to update reaction:', err);
		}
	}

	function scrollToBottom() {
		setTimeout(() => {
			messagesEndRef?.scrollIntoView({ behavior: 'smooth' });
		}, 100);
	}

	async function sendMessage() {
		const messageText = inputMessage.trim();
		
		// Validate input
		if (!messageText || isLoading) {
			return;
		}

		// Additional client-side validation
		if (messageText.length > 5000) {
			error = 'Message is too long (max 5000 characters)';
			return;
		}

		// Clear error
		error = null;

		// Add user message to UI immediately
		const userMessage: Message = {
			id: `user-${Date.now()}-${Math.random()}`,
			sender: 'user',
			text: messageText,
			timestamp: new Date(),
		};
		messages = [...messages, userMessage];
		inputMessage = '';
		isLoading = true;
		scrollToBottom();

		try {
			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

			const response = await fetch(API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: messageText,
					sessionId: sessionId || undefined,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({
					error: 'Server error',
					details: `HTTP ${response.status}`,
				}));
				throw new Error(errorData.details || errorData.error || `Server error: ${response.status}`);
			}

			const data = await response.json();

			// Validate response structure
			if (!data.reply || typeof data.reply !== 'string') {
				throw new Error('Invalid response from server');
			}

			// Update session ID
			if (data.sessionId && typeof data.sessionId === 'string') {
				sessionId = data.sessionId;
				// Persist session ID to localStorage
				try {
					localStorage.setItem('chatSessionId', data.sessionId);
				} catch (e) {
					console.warn('Failed to save session to localStorage:', e);
				}
			}

			// Add AI reply
			const aiMessage: Message = {
				id: `ai-${Date.now()}-${Math.random()}`,
				sender: 'ai',
				text: data.reply,
				timestamp: new Date(),
				reaction: null,
			};
			messages = [...messages, aiMessage];
			scrollToBottom();
		} catch (err: unknown) {
			console.error('Error sending message:', err);
			
			let errorMsg = 'Failed to send message. Please try again.';
			if (err instanceof Error) {
				if (err.name === 'AbortError') {
					errorMsg = 'Request timed out. Please try again.';
				} else if (err.message.includes('fetch')) {
					errorMsg = 'Network error. Please check your connection and try again.';
				} else {
					errorMsg = err.message || errorMsg;
				}
			}
			
			error = errorMsg;
			
			// Show error message in chat
			const errorMessage: Message = {
				id: `error-${Date.now()}-${Math.random()}`,
				sender: 'ai',
				text: 'Sorry, I encountered an error. Please try again.',
				timestamp: new Date(),
			};
			messages = [...messages, errorMessage];
			scrollToBottom();
		} finally {
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		const value = target.value;
		// Enforce max length on input
		if (value.length > 5000) {
			inputMessage = value.slice(0, 5000);
			error = 'Message is too long (max 5000 characters)';
			setTimeout(() => {
				error = null;
			}, 3000);
		}
	}

	onMount(async () => {
		// Restore session ID from localStorage
		try {
			const savedSessionId = localStorage.getItem('chatSessionId');
			if (savedSessionId && savedSessionId.trim().length > 0) {
				sessionId = savedSessionId;
				// Load conversation history
				await loadConversationHistory(savedSessionId);
			}
		} catch (e) {
			console.warn('Failed to load session from localStorage:', e);
			// Continue without session - will create new one
		}

		// Scroll to bottom on mount
		scrollToBottom();
	});
</script>

<div class="chat-container">
	<div class="chat-header">
		<h1>AI Support Chat</h1>
		<p class="subtitle">Get help with your questions</p>
	</div>

	<div class="messages-container">
		{#if messages.length === 0}
			<div class="empty-state">
				<p>👋 Hi! How can I help you today?</p>
			</div>
		{/if}

		{#each messages as message (message.id)}
			<div class="message message-{message.sender}">
				<div class="message-content">
					<p>{message.text}</p>
				</div>
				<span class="message-time">
					{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
				</span>
			</div>
		{/each}

		{#if isLoading}
			<div class="message message-ai">
				<div class="message-content">
					<div class="typing-indicator">
						<span></span>
						<span></span>
						<span></span>
					</div>
					<p class="typing-text">Agent is typing...</p>
				</div>
			</div>
		{/if}

		<div bind:this={messagesEndRef}></div>
	</div>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<div class="input-container">
		<textarea
			bind:value={inputMessage}
			onkeypress={handleKeyPress}
			oninput={handleInput}
			placeholder="Type your message... (Press Enter to send)"
			disabled={isLoading}
			rows="2"
			maxlength="5000"
			aria-label="Message input"
		></textarea>
		<button
			onclick={sendMessage}
			disabled={isLoading || !inputMessage.trim()}
			class="send-button"
			aria-label="Send message"
		>
			Send
		</button>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
			Cantarell, sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
	}

	.chat-container {
		max-width: 800px;
		margin: 0 auto;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: white;
		box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
	}

	.chat-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 1.5rem 2rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.chat-header h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0.25rem 0 0 0;
		font-size: 0.875rem;
		opacity: 0.9;
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: #f8f9fa;
	}

	.empty-state {
		text-align: center;
		color: #6c757d;
		margin: auto;
		font-size: 1.1rem;
	}

	.message {
		display: flex;
		flex-direction: column;
		max-width: 70%;
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message-user {
		align-self: flex-end;
	}

	.message-ai {
		align-self: flex-start;
	}

	.message-content {
		padding: 0.75rem 1rem;
		border-radius: 1rem;
		word-wrap: break-word;
	}

	.message-user .message-content {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-bottom-right-radius: 0.25rem;
	}

	.message-ai .message-content {
		background: white;
		color: #333;
		border: 1px solid #e0e0e0;
		border-bottom-left-radius: 0.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.message-content p {
		margin: 0;
		line-height: 1.5;
	}

	.message-time {
		font-size: 0.75rem;
		color: #6c757d;
		margin-top: 0.25rem;
		padding: 0 0.5rem;
	}

	.message-user .message-time {
		text-align: right;
	}

	.message-reactions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding: 0 0.5rem;
	}

	.reaction-btn {
		background: transparent;
		border: 1px solid #e0e0e0;
		border-radius: 0.25rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
	}

	.reaction-btn:hover {
		background: #f0f0f0;
		border-color: #667eea;
	}

	.reaction-btn.active {
		background: #667eea;
		border-color: #667eea;
		color: white;
	}

	.typing-indicator {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #667eea;
		animation: bounce 1.4s infinite ease-in-out;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}

	.typing-text {
		font-style: italic;
		color: #6c757d;
		font-size: 0.875rem;
	}

	.error-banner {
		background: #f8d7da;
		color: #721c24;
		padding: 0.75rem 1rem;
		margin: 0 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		border: 1px solid #f5c6cb;
	}

	.input-container {
		padding: 1.5rem;
		background: white;
		border-top: 1px solid #e0e0e0;
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.input-container textarea {
		flex: 1;
		padding: 0.75rem;
		border: 2px solid #e0e0e0;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-family: inherit;
		resize: none;
		transition: border-color 0.2s;
	}

	.input-container textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.input-container textarea:disabled {
		background: #f8f9fa;
		cursor: not-allowed;
	}

	.send-button {
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, opacity 0.2s;
	}

	.send-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-button:active:not(:disabled) {
		transform: translateY(0);
	}

	/* Scrollbar styling */
	.messages-container::-webkit-scrollbar {
		width: 8px;
	}

	.messages-container::-webkit-scrollbar-track {
		background: #f1f1f1;
	}

	.messages-container::-webkit-scrollbar-thumb {
		background: #888;
		border-radius: 4px;
	}

	.messages-container::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>