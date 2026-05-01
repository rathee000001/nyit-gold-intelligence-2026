/**
 * Gold Nexus Alpha — centralized JSON artifact paths.
 * Paths intentionally start with artifacts/.
 *
 * Local:
 *   public/artifacts/... is served as /artifacts/...
 *
 * Production/Vercel:
 *   NEXT_PUBLIC_ARTIFACT_BASE_URL + /artifacts/...
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
    officialForecast: "artifacts/pages/page_official_forecast.json",
    finalForecast: "artifacts/pages/page_final_forecast.json",
  },

  data: {
    factorInventory: "artifacts/data/factor_inventory.json",
    dataTableAudit: "artifacts/data/data_table_audit.json",
    weekdayCleaningAudit: "artifacts/data/weekday_cleaning_audit.json",
    missingValuesReport: "artifacts/data/missing_values_report.json",
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
    exponentialSmoothingPath:
      "artifacts/models/exponential_smoothing_forecast_path.json",

    regression: "artifacts/models/regression_results.json",
    regressionDiagnostics: "artifacts/models/regression_diagnostics.json",

    arima: "artifacts/models/arima_results.json",
    arimaDiagnostics: "artifacts/models/arima_diagnostics.json",
    arimaForecastPath: "artifacts/models/arima_forecast_path.json",

    sarimax: "artifacts/models/sarimax_results.json",
    sarimaxDiagnostics: "artifacts/models/sarimax_diagnostics.json",
    sarimaxForecastPath: "artifacts/models/sarimax_forecast_path.json",

    xgboost: "artifacts/models/xgboost_results.json",
    xgboostForecastPath: "artifacts/models/xgboost_forecast_path.json",

    prophet: "artifacts/models/prophet_results.json",
    prophetForecastPath: "artifacts/models/prophet_forecast_path.json",
  },

  interpretability: {
    regressionCoefficients: "artifacts/interpretability/regression_coefficients.json",
    xgboostFeatureImportance:
      "artifacts/interpretability/xgboost_feature_importance.json",
    xgboostShapSummary: "artifacts/interpretability/xgboost_shap_summary.json",
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
    officialForecastPath: "artifacts/forecast/official_forecast_path.json",
    forecastChartData: "artifacts/forecast/forecast_chart_data.json",
    forecastIntervals: "artifacts/forecast/forecast_intervals.json",
  },
} as const;