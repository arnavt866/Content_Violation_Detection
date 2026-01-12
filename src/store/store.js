import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Zustand store for managing analysis history and statistics
 * Includes persistence to localStorage for data retention across sessions
 */
export const useAnalysisStore = create(
  persist(
    (set, get) => ({
      // State
      analysisHistory: [],
      statistics: {
        totalAnalyses: 0,
        violationsDetected: 0,
        averageConfidence: 0,
        analysisTypes: {},
      },
      filters: {
        dateFrom: null,
        dateTo: null,
        violationType: 'all',
        sortBy: 'date', // date, confidence, status
        sortOrder: 'desc', // asc, desc
      },
      selectedAnalysis: null,
      isLoading: false,
      error: null,

      // Actions for Analysis History
      addAnalysis: (analysis) =>
        set((state) => {
          const newAnalysis = {
            id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            ...analysis,
          };

          const updatedHistory = [newAnalysis, ...state.analysisHistory];

          // Update statistics
          const updatedStatistics = {
            ...state.statistics,
            totalAnalyses: state.statistics.totalAnalyses + 1,
            violationsDetected:
              state.statistics.violationsDetected +
              (analysis.violations?.length || 0),
          };

          // Update analysis type statistics
          if (analysis.type) {
            updatedStatistics.analysisTypes = {
              ...updatedStatistics.analysisTypes,
              [analysis.type]: (updatedStatistics.analysisTypes[analysis.type] || 0) + 1,
            };
          }

          // Recalculate average confidence
          if (analysis.confidence !== undefined) {
            const allConfidences = [
              ...state.analysisHistory.map((a) => a.confidence || 0),
              analysis.confidence,
            ].filter((c) => c > 0);
            updatedStatistics.averageConfidence =
              allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
          }

          return {
            analysisHistory: updatedHistory,
            statistics: updatedStatistics,
          };
        }),

      removeAnalysis: (analysisId) =>
        set((state) => {
          const analysis = state.analysisHistory.find((a) => a.id === analysisId);
          if (!analysis) return state;

          const updatedHistory = state.analysisHistory.filter(
            (a) => a.id !== analysisId
          );

          const updatedStatistics = {
            ...state.statistics,
            totalAnalyses: Math.max(0, state.statistics.totalAnalyses - 1),
            violationsDetected: Math.max(
              0,
              state.statistics.violationsDetected - (analysis.violations?.length || 0)
            ),
          };

          // Update analysis type statistics
          if (analysis.type && updatedStatistics.analysisTypes[analysis.type]) {
            updatedStatistics.analysisTypes[analysis.type] =
              updatedStatistics.analysisTypes[analysis.type] - 1;
          }

          // Recalculate average confidence
          if (updatedHistory.length > 0) {
            const allConfidences = updatedHistory
              .map((a) => a.confidence || 0)
              .filter((c) => c > 0);
            updatedStatistics.averageConfidence =
              allConfidences.length > 0
                ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
                : 0;
          } else {
            updatedStatistics.averageConfidence = 0;
          }

          return {
            analysisHistory: updatedHistory,
            statistics: updatedStatistics,
            selectedAnalysis: state.selectedAnalysis?.id === analysisId ? null : state.selectedAnalysis,
          };
        }),

      updateAnalysis: (analysisId, updates) =>
        set((state) => {
          const analysisIndex = state.analysisHistory.findIndex((a) => a.id === analysisId);
          if (analysisIndex === -1) return state;

          const oldAnalysis = state.analysisHistory[analysisIndex];
          const updatedAnalysis = { ...oldAnalysis, ...updates };
          const newHistory = [...state.analysisHistory];
          newHistory[analysisIndex] = updatedAnalysis;

          // Update statistics if confidence changed
          let updatedStatistics = state.statistics;
          if (updates.confidence !== undefined && oldAnalysis.confidence !== updates.confidence) {
            const allConfidences = newHistory
              .map((a) => a.confidence || 0)
              .filter((c) => c > 0);
            updatedStatistics = {
              ...state.statistics,
              averageConfidence:
                allConfidences.length > 0
                  ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
                  : 0,
            };
          }

          return {
            analysisHistory: newHistory,
            statistics: updatedStatistics,
            selectedAnalysis: state.selectedAnalysis?.id === analysisId ? updatedAnalysis : state.selectedAnalysis,
          };
        }),

      clearHistory: () =>
        set({
          analysisHistory: [],
          statistics: {
            totalAnalyses: 0,
            violationsDetected: 0,
            averageConfidence: 0,
            analysisTypes: {},
          },
          selectedAnalysis: null,
        }),

      // Actions for Filtering and Sorting
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      resetFilters: () =>
        set({
          filters: {
            dateFrom: null,
            dateTo: null,
            violationType: 'all',
            sortBy: 'date',
            sortOrder: 'desc',
          },
        }),

      // Actions for Selection
      setSelectedAnalysis: (analysis) =>
        set({
          selectedAnalysis: analysis,
        }),

      clearSelectedAnalysis: () =>
        set({
          selectedAnalysis: null,
        }),

      // Actions for UI State
      setLoading: (isLoading) =>
        set({
          isLoading,
        }),

      setError: (error) =>
        set({
          error,
        }),

      clearError: () =>
        set({
          error: null,
        }),

      // Getters
      getFilteredHistory: () => {
        const state = get();
        let filtered = [...state.analysisHistory];

        // Apply date filters
        if (state.filters.dateFrom) {
          filtered = filtered.filter(
            (a) => new Date(a.timestamp) >= new Date(state.filters.dateFrom)
          );
        }
        if (state.filters.dateTo) {
          filtered = filtered.filter(
            (a) => new Date(a.timestamp) <= new Date(state.filters.dateTo)
          );
        }

        // Apply violation type filter
        if (state.filters.violationType !== 'all') {
          filtered = filtered.filter((a) =>
            a.violations?.some((v) => v.type === state.filters.violationType)
          );
        }

        // Apply sorting
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (state.filters.sortBy) {
            case 'confidence':
              comparison = (a.confidence || 0) - (b.confidence || 0);
              break;
            case 'status':
              comparison = (a.status || '').localeCompare(b.status || '');
              break;
            case 'date':
            default:
              comparison =
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          }

          return state.filters.sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
      },

      getStatistics: () => get().statistics,

      getAnalysisById: (id) =>
        get().analysisHistory.find((a) => a.id === id),

      getAnalysisByType: (type) =>
        get().analysisHistory.filter((a) => a.type === type),

      getRecentAnalyses: (limit = 10) =>
        get().analysisHistory.slice(0, limit),

      getViolationSummary: () => {
        const state = get();
        const summary = {};
        state.analysisHistory.forEach((analysis) => {
          analysis.violations?.forEach((violation) => {
            summary[violation.type] = (summary[violation.type] || 0) + 1;
          });
        });
        return summary;
      },
    }),
    {
      name: 'analysis-store',
      version: 1,
      // Optional: customize persistence
      // partialize: (state) => ({
      //   analysisHistory: state.analysisHistory,
      //   statistics: state.statistics,
      // }),
    }
  )
);

export default useAnalysisStore;
