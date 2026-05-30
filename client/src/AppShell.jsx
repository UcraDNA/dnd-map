import { useState, useCallback } from 'react';
import App from './App.jsx';
import SubMap from './pages/SubMap.jsx';

// AppShell manages a tab bar of open maps.
// Each tab: { id: string, type: 'main'|'submap', hexId?, mapId?, name? }
export default function AppShell() {
  const [tabs, setTabs] = useState([{ id: 'main', type: 'main', name: 'Mapa Principal' }]);
  const [activeTab, setActiveTab] = useState('main');

  const openSubmap = useCallback((hexId, mapId, name) => {
    const tabId = 'sub-' + hexId + '-' + mapId;
    setTabs(prev => {
      if (prev.find(t => t.id === tabId)) return prev;
      return [...prev, { id: tabId, type: 'submap', hexId, mapId, name: name || (hexId + ' / ' + mapId) }];
    });
    setActiveTab(tabId);
  }, []);

  const closeTab = useCallback((tabId, e) => {
    e.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      return next.length > 0 ? next : [{ id: 'main', type: 'main', name: 'Mapa Principal' }];
    });
    setActiveTab(prev => {
      if (prev !== tabId) return prev;
      // activate adjacent tab
      const idx = tabs.findIndex(t => t.id === tabId);
      const fallback = tabs[idx - 1] || tabs[idx + 1];
      return fallback ? fallback.id : 'main';
    });
  }, [tabs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Tab bar — only show if more than 1 tab */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#0d0d1a', borderBottom: '1px solid #0f3460',
          padding: '4px 8px', flexShrink: 0, overflowX: 'auto',
        }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: '4px 4px 0 0', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                background: activeTab === tab.id ? '#16213e' : 'transparent',
                border: activeTab === tab.id ? '1px solid #0f3460' : '1px solid transparent',
                borderBottom: activeTab === tab.id ? '1px solid #16213e' : '1px solid transparent',
                color: activeTab === tab.id ? '#eee' : '#666',
                transition: 'all 0.15s',
                marginBottom: activeTab === tab.id ? -1 : 0,
              }}
            >
              <span>{tab.type === 'main' ? '🗺' : '📍'}</span>
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.name}</span>
              {tab.id !== 'main' && (
                <span
                  onClick={e => closeTab(tab.id, e)}
                  style={{ marginLeft: 2, color: '#666', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                >×</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Map views — all mounted, only active is visible */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              position: 'absolute', inset: 0,
              display: activeTab === tab.id ? 'flex' : 'none',
            }}
          >
            {tab.type === 'main'
              ? <App onOpenSubmap={openSubmap} />
              : <SubMap hexId={tab.hexId} mapId={tab.mapId} onOpenSubmap={openSubmap} />
            }
          </div>
        ))}
      </div>
    </div>
  );
}
