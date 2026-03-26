pipeline {
    agent any
    
    // Alternatively, if you use Docker in Jenkins, you can use the Playwright image:
    // agent {
    //     docker {
    //         image 'mcr.microsoft.com/playwright:v1.58.2-jammy'
    //         args '--ipc=host'
    //     }
    // }

    triggers {
        // Run daily at 10 AM (Jenkins server time)
        cron('0 10 * * *')
    }

    environment {
        CI = 'true'
        // Define any required environment variables here
        // CUSTOMER_BASE_URL = 'https://www.aurazone.shop'

        CUSTOMER_BASE_URL='https://test.aurazone.shop'
        ADMIN_BASE_URL='https://test.admin.aurazone.shop'

        ADMIN_EMAIL='admin@aurazone.com'
        ADMIN_PASSWORD='Admin@123456'

        CUSTOMER_EMAIL='[EMAIL_ADDRESS]'
        CUSTOMER_PASSWORD='Umar2468/us!'

        WEBHOOK_SECRET='iuyjRxjEJGZzD+lqXxN8rjUGQS9pMMAlxXrVQNeMch4='
    }

    stages {
        stage('Checkout') {
            steps {
                // If you are using SCM like Git, this will checkout your repository
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('e2e') {
                    script {
                        
                            bat 'npm install'
                            // Ensure Playwright browsers and dependencies are installed
                            bat 'npx playwright install --with-deps'
                        
                    }
                }
            }
        }

        stage('Run E2E Tests') {
            steps {
                dir('e2e') {
                    // Run the playwright tests
                    script {
                        
                        bat 'npx playwright test'
                        
                    }
                }
            }
        }
    }

    post {
        always {
            dir('e2e') {
                // Publish the Playwright HTML report as a Jenkins artifact
                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'playwright-report',
                    reportFiles: 'index.html',
                    reportName: 'Playwright E2E Report',
                    reportTitles: 'Playwright E2E Report'
                ])
                
                // Also archive it so it can be downloaded
                archiveArtifacts artifacts: 'playwright-report/**/*', allowEmptyArchive: true
                
                // Zip the report for email attachment to avoid sending many loose files
                zip zipFile: 'playwright-report.zip', dir: 'playwright-report', archive: false
            }
        }
        success {
            emailext(
                to: env.ADMIN_EMAIL,
                subject: "SUCCESS: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
                body: "The E2E tests completed successfully.\n\nView build details at: ${env.BUILD_URL}",
                attachmentsPattern: 'e2e/playwright-report.zip'
            )
        }
        failure {
            emailext(
                to: env.ADMIN_EMAIL,
                subject: "FAILURE: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
                body: "The E2E tests failed.\n\nView build details at: ${env.BUILD_URL}",
                attachmentsPattern: 'e2e/playwright-report.zip'
            )
        }
    }
}
