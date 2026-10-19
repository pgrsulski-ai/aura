import { useEffect, useRef, useState } from 'react';
import { Heart, X, Send, ArrowDownToLine, Trash2 } from 'lucide-react';
import type { Comment, Post } from '@/types';
import { formatCount, timeAgo } from '@/hooks';

interface CommentsModalProps {
  post: Post;
  currentUserHandle: string;
  currentUserAvatar: string;
  isAdmin?: boolean;
  onClose: () => void;
  onAddComment: (postId: string, text: string) => void;
  onAddReply: (postId: string, commentId: string, text: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onLikeReply: (postId: string, commentId: string, replyId: string) => void;
  onAdminDeleteComment?: (commentId: string) => void;
}

export function CommentsModal({
  post,
  currentUserHandle,
  currentUserAvatar,
  isAdmin = false,
  onClose,
  onAddComment,
  onAddReply,
  onLikeComment,
  onLikeReply,
  onAdminDeleteComment,
}: CommentsModalProps) {
  const [text, setText] = useState('');
  const [replyParent, setReplyParent] = useState<Comment | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new comments/replies added
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [post.comments]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (replyParent) {
      onAddReply(post.id, replyParent.id, trimmed);
      setReplyParent(null);
    } else {
      onAddComment(post.id, trimmed);
    }
    setText('');
  };

  const handleReply = (comment: Comment) => {
    setReplyParent(comment);
    const mention = `@${comment.handle} `;
    setText(mention);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyParent(null);
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative mt-auto flex max-h-[75%] flex-col rounded-t-3xl border-t border-white/10 bg-neutral-900 animate-slide-up">
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="w-6" />
          <h3 className="font-display text-base font-bold text-white">
            {post.comments.length} Comments
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reply banner */}
        {replyParent && (
          <div className="flex items-center justify-between px-5 py-2 bg-neon/10 border-b border-neon/20 animate-fade-in">
            <span className="text-xs text-neon">
              Replying to <span className="font-semibold">{replyParent.handle}</span>
            </span>
            <button onClick={cancelReply} className="text-xs text-white/60">
              Cancel
            </button>
          </div>
        )}

        {/* Comments list */}
        <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {post.comments.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 rounded-full bg-white/5 p-4">
                <ArrowDownToLine className="h-6 w-6 text-white/40" />
              </div>
              <p className="text-sm text-white/50">Be the first to comment</p>
            </div>
          )}
          {post.comments.map((comment) => (
            <div key={comment.id} className="space-y-3">
              {/* Parent comment */}
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-emerald-700 text-xs font-bold text-neutral-950">
                  {comment.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-white/90">{comment.handle}</span>
                    <span className="text-[10px] text-white/40">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-white/90 break-words">{comment.text}</p>
                  <div className="mt-1.5 flex items-center gap-4">
                    <button
                      onClick={() => onLikeComment(post.id, comment.id)}
                      className="flex items-center gap-1 text-[11px] text-white/50 hover:text-neon transition-colors"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          comment.likes > 0 ? 'fill-neon text-neon' : ''
                        }`}
                      />
                      {comment.likes > 0 ? `${formatCount(comment.likes)} likes` : '0 likes'}
                    </button>
                    <button
                      onClick={() => handleReply(comment)}
                      className="text-[11px] font-semibold text-white/50 hover:text-neon transition-colors"
                    >
                      Reply
                    </button>
                    {isAdmin && onAdminDeleteComment && (
                      <button
                        onClick={() => onAdminDeleteComment(comment.id)}
                        className="flex items-center gap-0.5 text-[11px] font-semibold text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Nested replies */}
              {comment.replies.length > 0 && (
                <div className="ml-8 space-y-3 border-l border-white/10 pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-[10px] font-bold text-white">
                        {reply.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-white/90">{reply.handle}</span>
                          <span className="text-[10px] text-white/40">{timeAgo(reply.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-white/90 break-words">{reply.text}</p>
                        <button
                          onClick={() => onLikeReply(post.id, comment.id, reply.id)}
                          className="mt-1 flex items-center gap-1 text-[11px] text-white/50 hover:text-neon transition-colors"
                        >
                          <Heart
                            className={`h-3 w-3 ${
                              reply.likes > 0 ? 'fill-neon text-neon' : ''
                            }`}
                          />
                          {reply.likes > 0 ? `${formatCount(reply.likes)} likes` : '0 likes'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="border-t border-white/10 px-4 py-3 pb-5 bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-emerald-700 text-xs font-bold text-neutral-950">
              {currentUserAvatar}
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white/8 px-4 py-2.5">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit();
                }}
                placeholder={replyParent ? `Reply to ${replyParent.handle}...` : 'Add a comment...'}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className={`rounded-full p-2.5 transition-all ${
                text.trim()
                  ? 'bg-neon text-neutral-950 neon-glow'
                  : 'bg-white/10 text-white/30'
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
