import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Users, MessageCircle, BookOpen, BookMarked, Star, PlusCircle, LogIn } from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  read_article: <BookOpen className="h-3.5 w-3.5" />,
  complete_exercise: <MessageCircle className="h-3.5 w-3.5" />,
  save_vocab: <BookMarked className="h-3.5 w-3.5" />,
  share_note: <Star className="h-3.5 w-3.5" />,
  join_group: <Users className="h-3.5 w-3.5" />,
};

const ACTIVITY_LABELS: Record<string, string> = {
  read_article: "read", complete_exercise: "completed exercises for",
  save_vocab: "saved vocabulary", share_note: "shared a note",
  join_group: "joined group",
};

export function CommunityPage() {
  const queryClient = useQueryClient();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => api.feed.list(),
  });

  const { data: groupData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.groups.list(),
  });

  const createGroupMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) => api.groups.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
    },
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: number) => api.groups.join(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });

  const feed = feedData?.items || [];
  const groups = groupData?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-500" /> Community
        </h1>
        <p className="text-gray-500 text-sm mt-1">Connect with other learners</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Activity Feed */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>

          {feedLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}</div>
          ) : feed.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No activity yet. Start reading to appear here!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feed.map(item => (
                <div key={item.id} className="bg-white rounded-lg border p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
                    {ACTIVITY_ICONS[item.activityType] || <Star className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{item.userName}</span>{" "}
                      <span className="text-gray-500">{ACTIVITY_LABELS[item.activityType] || item.activityType}</span>
                      {item.summary ? <span className="text-gray-700"> {item.summary}</span> : null}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Groups sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Study Groups</h2>
            <button onClick={() => setShowCreateGroup(!showCreateGroup)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              <PlusCircle className="h-3.5 w-3.5" /> Create
            </button>
          </div>

          {showCreateGroup && (
            <div className="bg-white rounded-lg border p-3 mb-3 space-y-2">
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <button onClick={() => createGroupMutation.mutate({ name: groupName, description: groupDesc || undefined })}
                disabled={!groupName.trim() || createGroupMutation.isPending}
                className="w-full py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </button>
            </div>
          )}

          {groupsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border">
              <p className="text-gray-400 text-sm">No groups yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(group => (
                <div key={group.id} className="bg-white rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-800">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{group.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{group.memberCount} members</span>
                    <button onClick={() => joinMutation.mutate(group.id)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      <LogIn className="h-3 w-3" /> Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
