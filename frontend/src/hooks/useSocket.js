import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useEditorStore } from '../store/editor.store';

export function useSocket(roomId, editorRef, isRemote, setOutputResult, setShowOutput) {
  const clientRevision = useRef(0);
  const joinedRef      = useRef(false);

  const setDocument  = useEditorStore((s) => s.setDocument);
  const setRevision  = useEditorStore((s) => s.setRevision);
  const setUsers     = useEditorStore((s) => s.setUsers);
  const setConnected = useEditorStore((s) => s.setConnected);
  const setLanguage  = useEditorStore((s) => s.setLanguage);

  useEffect(() => {
    if (!roomId) return;
    const socket = connectSocket();

    function joinRoom() {
      if (joinedRef.current) return;
      joinedRef.current = true;
      setConnected(true);

      socket.emit('join-room', { roomId }, ({ error, content, revision } = {}) => {
        if (error) { console.error('[socket] join error:', error); return; }
        setDocument({ content, revision });
        clientRevision.current = revision ?? 0;
      });
    }

    function onRemoteOp({ op }) {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      isRemote.current = true;
      try {
        if (op.type === 'insert') {
          const pos = model.getPositionAt(op.position);
          model.applyEdits([{
            range: {
              startLineNumber: pos.lineNumber, startColumn: pos.column,
              endLineNumber:   pos.lineNumber, endColumn:   pos.column,
            },
            text: op.chars,
          }]);
        } else if (op.type === 'delete') {
          const start = model.getPositionAt(op.position);
          const end   = model.getPositionAt(op.position + op.length);
          model.applyEdits([{
            range: {
              startLineNumber: start.lineNumber, startColumn: start.column,
              endLineNumber:   end.lineNumber,   endColumn:   end.column,
            },
            text: '',
          }]);
        }
      } finally {
        isRemote.current = false;
      }

      clientRevision.current = op.revision;
      setRevision(op.revision);
    }

    // When another user runs code, show result to everyone
    function onExecutionResult(data) {
      if (setOutputResult) setOutputResult(data);
      if (setShowOutput)   setShowOutput(true);
    }

    function onPresence({ users })      { setUsers(users); }
    function onLangChange({ language }) { setLanguage(language); }
    function onDisconnect()             { setConnected(false); joinedRef.current = false; }
    function onReconnect()              { joinedRef.current = false; joinRoom(); }

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once('connect', joinRoom);
    }

    socket.on('remote-operation',  onRemoteOp);
    socket.on('execution-result',  onExecutionResult);
    socket.on('presence',          onPresence);
    socket.on('language-changed',  onLangChange);
    socket.on('disconnect',        onDisconnect);
    socket.on('reconnect',         onReconnect);

    return () => {
      socket.off('connect',         joinRoom);
      socket.off('remote-operation', onRemoteOp);
      socket.off('execution-result', onExecutionResult);
      socket.off('presence',         onPresence);
      socket.off('language-changed', onLangChange);
      socket.off('disconnect',       onDisconnect);
      socket.off('reconnect',        onReconnect);
      disconnectSocket();
      setConnected(false);
      joinedRef.current = false;
    };
  }, [roomId]);

  function sendOp(op) {
    const socket = getSocket();
    if (!socket?.connected) return;
    const opWithRev = { ...op, revision: clientRevision.current };
    socket.emit('operation', { roomId, op: opWithRev }, ({ error, revision } = {}) => {
      if (error) { console.error('[socket] op error:', error); return; }
      clientRevision.current = revision;
    });
  }

  function sendCursor(cursor)   { getSocket()?.emit('cursor-move',      { roomId, cursor }); }
  function sendLanguageChange(l){ getSocket()?.emit('language-change',  { roomId, language: l }); }

  return { sendOp, sendCursor, sendLanguageChange };
}