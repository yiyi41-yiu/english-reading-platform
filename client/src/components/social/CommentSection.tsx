import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { MessageCircle, Heart, Trash2, Send } from "lucide-react";

interface Comment {
  id: number;
  articleId: number;
  userId: number;
  parentId: number | null;
  content: string;
  likes: number;
  createdAt: string;
  userName: string;
}

interface CommentSectionProps {
  articleId: number;
}

export function CommentSection({ articleId }: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: () => api.comments.list(articleId),
  });

  const addMutation = useMutation({
    mutationFn: (body: { article_id: number; content: string; parent_id?: number }) =>
      api.comments.add(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", articleId] });
      setNewComment("");
      setReplyText("");
      setReplyTo(null);
    },
  });

  const likeMutation = useMutation({
    mutationFn: (commentId: number) => api.comments.like(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", articleId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => api.comments.remove(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comments", articleId] }),
  });

  const comments: Comment[] = data?.items || [];
  const topLevel = comments.filter(c => !c.parentId);
  const replies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  const handleAdd = () => {
    if (!newComment.trim()) return;
    addMutation.mutate({ article_id: articleId, content: newComment.trim() });
  };

  const handleReply = (parentId: number) => {
    if (!replyText.trim()) return;
    addMutation.mutate({ article_id: articleId, content: replyText.trim(), parent_id: parentId });
  };

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5" /> Comments
      </h3>

      {/* New comment input */}
      <div className="flex gap-2 mb-6">
        <input
          type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newComment.trim() || addMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
          <Send className="h-3.5 w-3.5" /> Post
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {topLevel.map(comment => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                onLike={() => likeMutation.mutate(comment.id)}
                onDelete={() => deleteMutation.mutate(comment.id)}
                onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              />
              {/* Reply input */}
              {replyTo === comment.id && (
                <div className="ml-10 mt-2 flex gap-2">
                  <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={e => e.key === "Enter" && handleReply(comment.id)}
                  />
                  <button onClick={() => handleReply(comment.id)} disabled={!replyText.trim()}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50">
                    Reply
                  </button>
                </div>
              )}
              {/* Replies */}
              {replies(comment.id).map(reply => (
                <div key={reply.id} className="ml-10 mt-2">
                  <CommentItem
                    comment={reply}
                    onLike={() => likeMutation.mutate(reply.id)}
                    onDelete={() => deleteMutation.mutate(reply.id)}
                    isReply
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, onLike, onDelete, onReply, isReply }: {
  comment: Comment;
  onLike: () => void;
  onDelete: () => void;
  onReply?: () => void;
  isReply?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg border p-3 ${isReply ? "border-gray-100" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">{comment.userName}</span>
          <span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <p className="text-sm text-gray-800">{comment.content}</p>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={onLike} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
          <Heart className="h-3 w-3" /> {comment.likes}
        </button>
        {onReply && (
          <button onClick={onReply} className="text-xs text-gray-400 hover:text-blue-500">Reply</button>
        )}
      </div>
    </div>
  );
}
