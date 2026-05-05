<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		show = $bindable(false),
		title = '',
		message = '',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		onConfirm,
		onCancel
	}: {
		show?: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm?: () => void;
		onCancel?: () => void;
	} = $props();

	function handleConfirm() {
		if (onConfirm) onConfirm();
		show = false;
	}

	function handleCancel() {
		if (onCancel) onCancel();
		show = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && show) {
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div class="modal-overlay">
		<button type="button" class="modal-backdrop" aria-label="Close modal" onclick={handleCancel}></button>
		<div class="modal-card">
			<div class="modal-header">
				<h3>{title}</h3>
				<button type="button" class="close-btn" onclick={handleCancel}>
					<X size={16} />
				</button>
			</div>
			<div class="modal-body">
				<p>{message}</p>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={handleCancel}>
					{cancelText}
				</button>
				<button type="button" class="btn-confirm" onclick={handleConfirm}>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		z-index: 100;
		padding: 1rem;
	}

	.modal-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(2, 6, 23, 0.72);
		cursor: default;
	}

	.modal-card {
		position: relative;
		width: min(400px, 100%);
		border: 1px solid #334155;
		border-radius: 0.9rem;
		background: #020617;
		padding: 1.25rem;
		z-index: 1;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.modal-header h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: #e2e8f0;
		margin: 0;
	}

	.close-btn {
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 0.55rem;
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}

	.close-btn:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.modal-body {
		margin-bottom: 1.5rem;
	}

	.modal-body p {
		color: #94a3b8;
		font-size: 0.95rem;
		line-height: 1.5;
		margin: 0;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.btn-cancel,
	.btn-confirm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 1rem;
		font-size: 0.88rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn-cancel {
		border: 1px solid #334155;
		background: #0f172a;
		color: #e2e8f0;
	}

	.btn-cancel:hover {
		background: #1e293b;
		border-color: #475569;
	}

	.btn-confirm {
		border: 1px solid #2563eb;
		background: linear-gradient(135deg, #2563eb, #3b82f6);
		color: white;
	}

	.btn-confirm:hover {
		background: linear-gradient(135deg, #1d4ed8, #2563eb);
		border-color: #1d4ed8;
	}
</style>
