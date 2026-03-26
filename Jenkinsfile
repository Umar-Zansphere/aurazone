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
                    sh 'npm install'
                    // Ensure Playwright browsers and dependencies are installed
                    sh 'npx playwright install --with-deps'
                }
            }
        }

        stage('Run E2E Tests') {
            steps {
                dir('e2e') {
                    // Run the playwright tests
                    sh 'npx playwright test'
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
            }
        }
    }
}
