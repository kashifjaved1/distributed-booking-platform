{{- define "bookingplatform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "bookingplatform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "bookingplatform.labels" -}}
helm.sh/chart: {{ include "bookingplatform.name" . }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: booking-platform
{{- end }}

{{- define "bookingplatform.postgres.connection" -}}
Host=postgres;Port=5432;Database={{ .database }};Username={{ .Values.global.postgres.username }};Password={{ .Values.global.postgres.password }}
{{- end }}

{{- define "bookingplatform.rabbitmq.connection" -}}
amqp://{{ .Values.global.rabbitmq.username }}:{{ .Values.global.rabbitmq.password }}@rabbitmq:5672
{{- end }}
