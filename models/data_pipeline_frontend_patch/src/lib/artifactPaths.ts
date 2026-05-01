/**
 * Gold Nexus Alpha — JSON artifact path registry
 * Keep paths centralized so frontend pages do not hardcode data-source logic.
 */

export const artifactPaths = {
  pages: {
    dataPipeline: "artifacts/pages/page_data_pipeline.json",
    naiveMovingAverage: "artifacts/pages/page_naive_moving_average.json",
    exponentialSmoothing: "artifacts/pages/page_exponential_smoothing.json",
    regression: "artifacts/pages/page_regression.json",
    arima: "artifacts/pages/page_arima.json",
    sarimax: "artifacts/pages/page_sarimax.json",
    xgboost: "artifacts/pages/page_xgboost.json",
    prophet: "artifacts/pages/page_prophet.json",
    modelComparison: "artifacts/pages/page_model_comparison.json",
    finalForecast: "artifacts/pages/page_final_forecast.json",
  },
  data: {
    factorInventory: "artifacts/data/factor_inventory.json",
    dataTableAudit: "artifacts/data/data_table_audit.json",
    missingValuesReport: "artifacts/data/missing_values_report.json",
    weekdayCleaningAudit: "artifacts/data/weekday_cleaning_audit.json",
    weekdayMatrixPreview: "artifacts/data/weekday_matrix_preview.json",
    featureDictionary: "artifacts/data/feature_dictionary.json",
    featureEngineeringAudit: "artifacts/data/feature_engineering_audit.json",
    modelReadyDatasetPreview: "artifacts/data/model_ready_dataset_preview.json",
  },
  governance: {
    forecastStatus: "artifacts/governance/forecast_status.json",
    forecastGovernance: "artifacts/governance/forecast_governance.json",
    modelWindowPlan: "artifacts/governance/model_window_plan.json",
    cutoffDecisionLog: "artifacts/governance/cutoff_decision_log.json",
  },
  models: {
    naive: "artifacts/models/naive_results.json",
    movingAverage: "artifacts/models/moving_average_results.json",
    baselineForecastPaths: "artifacts/models/baseline_forecast_paths.json",
    exponentialSmoothing: "artifacts/models/exponential_smoothing_results.json",
    exponentialSmoothingPath: "artifacts/models/exponential_smoothing_forecast_path.json",
    regression: "artifacts/models/regression_results.json",
    arima: "artifacts/models/arima_results.json",
    sarimax: "artifacts/models/sarimax_results.json",
    xgboost: "artifacts/models/xgboost_results.json",
    prophet: "artifacts/models/prophet_results.json",
  },
  validation: {
    validationSummary: "artifacts/validation/validation_summary.json",
    validationByModel: "artifacts/validation/validation_by_model.json",
    modelRanking: "artifacts/validation/model_ranking.json",
    residualDiagnostics: "artifacts/validation/residual_diagnostics.json",
    selectedModelSummary: "artifacts/validation/selected_model_summary.json",
  },
  forecast: {
    officialForecast: "artifacts/forecast/official_forecast.json",
    forecastChartData: "artifacts/forecast/forecast_chart_data.json",
    forecastIntervals: "artifacts/forecast/forecast_intervals.json",
  },
} as const;
