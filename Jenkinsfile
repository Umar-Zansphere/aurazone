pipeline {
    agent any

    triggers {
        cron('0 11 * * *')
    }

    environment {
        CI = 'true'
        CUSTOMER_BASE_URL='https://test.aurazone.shop'
        ADMIN_BASE_URL='https://test.admin.aurazone.shop'

        ADMIN_EMAIL='admin@aurazone.com'
        ADMIN_PASSWORD='Admin@123456'

        CUSTOMER_EMAIL='umar.zangroups@gmail.com'
        CUSTOMER_PASSWORD='Umar2468/us!'

        RP_API_KEY=credentials('RP_API_KEY')
        RP_ENDPOINT='http://localhost:9090/'
        RP_PROJECT='AuraZone_selenium'
        RP_LAUNCH='AuraZone Selenium Tests'
        HEADLESS='true'
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
                dir('selenium') {
                    bat '''
                    py -m venv .venv
                    .venv\\Scripts\\python -m pip install --upgrade pip
                    .venv\\Scripts\\python -m pip install -r requirements.txt
                    '''
                }
            }
        }

        stage('Run Selenium Tests') {
            steps {
                dir('selenium') {
                    bat '''
                    .venv\\Scripts\\python -m pytest --reportportal ^
                        -o "rp_endpoint=%RP_ENDPOINT%" ^
                        -o "rp_project=%RP_PROJECT%" ^
                        -o "rp_launch=%RP_LAUNCH% #%BUILD_NUMBER%"
                    '''
                }
            }
        }
    }
}
