import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Settings, Key, Globe, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("deepseek");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["auth", "settings"],
    queryFn: () => api.auth.getSettings(),
  });

  const mutation = useMutation({
    mutationFn: (body: { api_key?: string; api_provider?: string }) => api.auth.updateSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  useEffect(() => {
    if (settings) {
      setProvider(settings.apiProvider || "deepseek");
    }
  }, [settings]);

  const handleSave = () => {
    const body: { api_key?: string; api_provider?: string } = { api_provider: provider };
    if (apiKey && !apiKey.startsWith("****")) {
      body.api_key = apiKey;
    }
    mutation.mutate(body);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-500" /> Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">Configure your API key for AI features</p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key className="h-4 w-4" /> API Provider
            </label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={settings?.hasApiKey ? "Enter new key to replace existing" : "sk-..."}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {settings?.hasApiKey && (
              <p className="text-xs text-gray-500 mt-1">API key configured (current: {settings.apiKey}). Enter a new one to change it.</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Your API key is stored encrypted and only used for your own requests. If not set, the server key is used as fallback.
            </p>
          </div>

          <button onClick={handleSave} disabled={mutation.isPending}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {saved ? <><CheckCircle2 className="h-4 w-4" /> Saved</> : mutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
