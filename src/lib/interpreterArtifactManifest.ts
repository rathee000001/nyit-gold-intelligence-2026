export type InterpreterArtifact = {
  key: string;
  label: string;
  path: string;
  group: "data" | "governance" | "model" | "validation" | "forecast" | "page";
  tags: string[];
};

export const interpreterArtifacts: InterpreterArtifact[] = [
  {
    key: "pageDataPipeline",
    label: "Page Data Pipeline",
    path: "artifacts/pages/page_data_pipeline.json",
    group: "page",
    tags: ["data", "pipeline", "matrix", "cleaning", "weekday", "factor", "registry"],
  },
  {
    key: "factorInventory",
    label: "Factor Inventory",
    path: "artifacts/data/factor_inventory.json",
    group: "data",
    tags: ["factor", "registry", "inventory", "high_yield", "source", "frequency"],
  },
  {
    key: "dataTableAudit",
    label: "Data Table Audit",
    path: "artifacts/data/data_table_audit.json",
    group: "data",
    tags: ["matrix", "rows", "columns", "audit", "date", "range"],
  },
  {
    key: "weekdayCleaningAudit",
    label: "Weekday Cleaning Audit",
    path: "artifacts/data/weekday_cleaning_audit.json",
    group: "data",
    tags: ["weekday", "weekend", "cleaning", "rows", "saturday", "sunday"],
  },
  {
    key: "missingValuesReport",
    label: "Missing Values Report",
    path: "artifacts/data/missing_values_report.json",
    group: "data",
    tags: ["missing", "null", "coverage", "values"],
  },
  {
    key: "forecastStatus",
    label: "Forecast Status",
    path: "artifacts/governance/forecast_status.json",
    group: "governance",
    tags: ["cutoff", "official", "status", "governance", "forecast"],
  },
  {
    key: "modelWindowPlan",
    label: "Model Window Plan",
    path: "artifacts/governance/model_window_plan.json",
    group: "governance",
    tags: ["window", "train", "validation", "test", "split", "cutoff"],
  },

  {
    key: "pageNaiveMovingAverage",
    label: "Page Naive Moving Average",
    path: "artifacts/pages/page_naive_moving_average.json",
    group: "page",
    tags: ["naive", "moving", "average", "baseline"],
  },
  {
    key: "pageExponentialSmoothing",
    label: "Page Exponential Smoothing",
    path: "artifacts/pages/page_exponential_smoothing.json",
    group: "page",
    tags: ["exponential", "smoothing", "holt", "trend"],
  },
  {
    key: "pageRegression",
    label: "Page Regression",
    path: "artifacts/pages/page_regression.json",
    group: "page",
    tags: ["regression", "ols", "raw", "factor", "significant", "p-value"],
  },
  {
    key: "pageArima",
    label: "Page ARIMA",
    path: "artifacts/pages/page_arima.json",
    group: "page",
    tags: ["arima", "univariate", "forecast", "order"],
  },
  {
    key: "pageSarimax",
    label: "Page SARIMAX",
    path: "artifacts/pages/page_sarimax.json",
    group: "page",
    tags: ["sarimax", "exogenous", "arima", "factor"],
  },
  {
    key: "pageXgboost",
    label: "Page XGBoost",
    path: "artifacts/pages/page_xgboost.json",
    group: "page",
    tags: ["xgboost", "machine", "learning", "feature", "importance"],
  },

  {
    key: "naiveResults",
    label: "Naive Results",
    path: "artifacts/models/naive_results.json",
    group: "model",
    tags: ["naive", "baseline", "metrics"],
  },
  {
    key: "movingAverageResults",
    label: "Moving Average Results",
    path: "artifacts/models/moving_average_results.json",
    group: "model",
    tags: ["moving", "average", "window", "metrics"],
  },
  {
    key: "baselineForecastPaths",
    label: "Baseline Forecast Paths",
    path: "artifacts/models/baseline_forecast_paths.json",
    group: "model",
    tags: ["baseline", "forecast", "path", "naive", "moving"],
  },
  {
    key: "exponentialSmoothingResults",
    label: "Exponential Smoothing Results",
    path: "artifacts/models/exponential_smoothing_results.json",
    group: "model",
    tags: ["exponential", "smoothing", "holt", "metrics"],
  },
  {
    key: "regressionResults",
    label: "Regression Results",
    path: "artifacts/models/regression_results.json",
    group: "model",
    tags: ["regression", "ols", "raw", "factor", "coefficient", "significant"],
  },
  {
    key: "arimaResults",
    label: "ARIMA Results",
    path: "artifacts/models/arima_results.json",
    group: "model",
    tags: ["arima", "order", "metrics", "forecast"],
  },
  {
    key: "sarimaxResults",
    label: "SARIMAX Results",
    path: "artifacts/models/sarimax_results.json",
    group: "model",
    tags: ["sarimax", "metrics", "exogenous"],
  },
  {
    key: "xgboostResults",
    label: "XGBoost Results",
    path: "artifacts/models/xgboost_results.json",
    group: "model",
    tags: ["xgboost", "metrics", "feature", "candidate"],
  },
  {
    key: "regressionCoefficients",
    label: "Regression Coefficients",
    path: "artifacts/interpretability/regression_coefficients.json",
    group: "model",
    tags: ["regression", "coefficient", "p-value", "significance"],
  },
  {
    key: "xgboostFeatureImportance",
    label: "XGBoost Feature Importance",
    path: "artifacts/interpretability/xgboost_feature_importance.json",
    group: "model",
    tags: ["xgboost", "feature", "importance"],
  },
  {
    key: "xgboostShapSummary",
    label: "XGBoost SHAP Summary",
    path: "artifacts/interpretability/xgboost_shap_summary.json",
    group: "model",
    tags: ["xgboost", "shap", "importance", "interpretability"],
  },

  {
    key: "pageModelComparison",
    label: "Page Model Comparison",
    path: "artifacts/pages/page_model_comparison.json",
    group: "page",
    tags: ["comparison", "ranking", "validation", "selected", "winner"],
  },
  {
    key: "modelRanking",
    label: "Model Ranking",
    path: "artifacts/validation/model_ranking.json",
    group: "validation",
    tags: ["ranking", "comparison", "best", "winner", "validation", "rmse"],
  },
  {
    key: "selectedModelSummary",
    label: "Selected Model Summary",
    path: "artifacts/validation/selected_model_summary.json",
    group: "validation",
    tags: ["selected", "winner", "best", "model", "ranking"],
  },
  {
    key: "validationSummary",
    label: "Validation Summary",
    path: "artifacts/validation/validation_summary.json",
    group: "validation",
    tags: ["validation", "summary", "metrics"],
  },
  {
    key: "validationByModel",
    label: "Validation By Model",
    path: "artifacts/validation/validation_by_model.json",
    group: "validation",
    tags: ["validation", "model", "metrics", "comparison"],
  },
  {
    key: "residualDiagnostics",
    label: "Residual Diagnostics",
    path: "artifacts/validation/residual_diagnostics.json",
    group: "validation",
    tags: ["residual", "diagnostics", "error"],
  },

  {
    key: "pageOfficialForecast",
    label: "Page Official Forecast",
    path: "artifacts/pages/page_official_forecast.json",
    group: "page",
    tags: ["official", "forecast", "final", "future", "cutoff"],
  },
  {
    key: "officialForecast",
    label: "Official Forecast",
    path: "artifacts/forecast/official_forecast.json",
    group: "forecast",
    tags: ["official", "forecast", "final", "future", "cutoff", "arima"],
  },
];

export const projectIdentity = {
  name: "Gold Nexus Alpha",
  description:
    "A JSON-first, professor-style gold forecasting platform. Pipeline: Google Colab notebooks → GitHub CSV/JSON artifacts → Vercel/Next.js frontend.",
  rules: [
    "Project answers must be grounded in approved JSON artifacts.",
    "Do not invent model winners, claims, drivers, limitations, or forecasts.",
    "If a project-specific answer is not available in artifacts, say so.",
    "General non-project questions may be answered by the AI when OPENAI_API_KEY is configured, but they must be clearly labeled as general AI guidance.",
    "The bot is an interpreter, not the forecasting engine. Forecasts come from notebook artifacts.",
  ],
};
