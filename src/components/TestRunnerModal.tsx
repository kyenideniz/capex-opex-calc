import React, { useState, useEffect } from 'react';
import { TestCaseResult } from '../types';
import { api } from '../api';
import { FlaskConical, CheckCircle2, XCircle, RefreshCw, X } from 'lucide-react';

interface TestRunnerModalProps {
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ onClose }) => {
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [passedCount, setPassedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    executeTests();
  }, []);

  const executeTests = async () => {
    setIsRunning(true);
    try {
      const res = await api.runTests();
      setResults(res.results);
      setPassedCount(res.passed);
      setTotalCount(res.total);
    } catch (e) {
      console.error('Failed to run tests:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Automated Test Suite (14 Business Cases)</h3>
              <p className="text-xs text-slate-500">
                Verifies CJI3 parsing, subtotal exclusions, vendor normalization, negative reversals, and snapshot deltas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={executeTests}
              disabled={isRunning}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running...' : 'Re-run Tests'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results Banner */}
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">Test Execution Summary:</span>
            <span className="font-mono font-bold text-slate-900">
              {passedCount} / {totalCount} Passed
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {passedCount === totalCount && totalCount > 0 ? (
              <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All 14 Business Test Cases Passed</span>
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold text-xs border border-amber-200">
                {totalCount - passedCount} Tests Failing
              </span>
            )}
          </div>
        </div>

        {/* Test Cases List */}
        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white text-xs">
          {isRunning ? (
            <p className="py-8 text-center text-slate-400">Executing automated test suite assertions...</p>
          ) : (
            results.map((r) => (
              <div key={r.id} className="p-3.5 hover:bg-slate-50 transition space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">{r.title}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      r.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pl-6 font-mono">{r.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
