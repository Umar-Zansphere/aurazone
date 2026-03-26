pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    triggers {
        cron('0 10 * * *')
    }

    environment {
        CI = 'true'
        CUSTOMER_BASE_URL='https://test.aurazone.shop'
        ADMIN_BASE_URL='https://test.admin.aurazone.shop'

        ADMIN_EMAIL='admin@aurazone.com'
        ADMIN_PASSWORD='Admin@123456'

        CUSTOMER_EMAIL='umar.zangroups@gmail.com'
        CUSTOMER_PASSWORD='Umar2468/us!'

        WEBHOOK_SECRET='iuyjRxjEJGZzD+lqXxN8rjUGQS9pMMAlxXrVQNeMch4='
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('e2e') {
                    bat 'npm install'
                    bat 'npx playwright install chromium'
                }
            }
        }

        stage('Run E2E Tests') {
            steps {
                dir('e2e') {
                    bat 'npx playwright test'
                }
            }
        }
    }

    post {
    always {
        dir('e2e') {
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright E2E Report'
            ])

            archiveArtifacts artifacts: 'playwright-report/**/*', allowEmptyArchive: true

            // ZIP using PowerShell (Windows-safe)
            bat '''
            powershell -Command "Compress-Archive -Path playwright-report\\* -DestinationPath playwright-report.zip -Force"
            '''
        }
    }

        success {
            emailext(
                to: 'umarmohamed444481@gmail.com',
                subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Tests passed: ${env.BUILD_URL}",
                attachmentsPattern: 'playwright-report.zip'
            )
        }

        failure {
            emailext(
                to: 'umarmohamed444481@gmail.com',
                subject: "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Tests failed: ${env.BUILD_URL}",
                attachmentsPattern: 'playwright-report.zip'
            )
        }
    }
}