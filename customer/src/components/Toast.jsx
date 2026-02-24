'use client';

import { useEffect, useState } from 'react';
import { useToast } from './ToastContext';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export default function Toast() {
    const { toasts, hideToast } = useToast();

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onClose }) {
    const [isExiting, setIsExiting] = useState(false);
    const [touchStart, setTouchStart] = useState(null);
    const [touchOffset, setTouchOffset] = useState(0);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    const handleTouchStart = (e) => {
        setTouchStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        if (touchStart === null) return;
        const currentTouch = e.touches[0].clientX;
        const offset = currentTouch - touchStart;
        if (offset > 0) {
            setTouchOffset(offset);
        }
    };

    const handleTouchEnd = () => {
        if (touchOffset > 100) {
            handleClose();
        }
        setTouchOffset(0);
        setTouchStart(null);
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="toast-icon" />;
            case 'error':
                return <XCircle className="toast-icon" />;
            case 'warning':
                return <AlertCircle className="toast-icon" />;
            default:
                return <Info className="toast-icon" />;
        }
    };

    return (
        <div
            className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
            style={{ transform: `translateX(${touchOffset}px)` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="alert"
            aria-live="polite"
        >
            <div className="toast-content">
                {getIcon()}
                <p className="toast-message">{toast.message}</p>
            </div>
            <button
                onClick={handleClose}
                className="toast-close"
                aria-label="Close notification"
            >
                <X size={18} />
            </button>
        </div>
    );
}
