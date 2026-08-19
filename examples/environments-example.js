// ─── Conteúdo do environments.example.json embutido ──────────────────────────
// Permite download mesmo em file:// (sem servidor).

const ENVIRONMENTS_EXAMPLE = [
    {
        "name": "Meu Ambiente DEV",
        "title": "Api Gateway - DEV",
        "description": "Ambiente de desenvolvimento",
        "basePath": "/dev",
        "x-amazon-apigateway-security-policy": "TLS_1_0",

        "authorizerCredentials": "arn:aws:iam::111111111111:role/lambda_auth_role_InvokeFunction",
        "authorizerUri": "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:111111111111:function:api_gateway_authorizer_dev/invocations",

        "connectionId": "abc111",
        "host": "dev-api.execute-api.us-east-1.amazonaws.com",
        "hostPortal": "'https://portal.dev.example.com'",
        "nlb": "http://NLB-DEV.elb.us-east-1.amazonaws.com",

        "defaultGroups": ["Meu Grupo A", "Meu Grupo B"]
    },
    {
        "name": "Meu Ambiente PROD",
        "title": "Api Gateway - PROD",
        "description": "Ambiente de produção",
        "basePath": "/prod",
        "x-amazon-apigateway-security-policy": "TLS_1_2",

        "x-amazon-apigateway-endpoint-configuration": {
            "vpcEndpointIds": ["vpce-XXXXXXXXXXXXXXXXX"]
        },
        "x-amazon-apigateway-policy": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "execute-api:Invoke",
                    "Resource": "arn:aws:execute-api:us-east-1:333333333333:API_ID/*"
                },
                {
                    "Effect": "Deny",
                    "Principal": "*",
                    "Action": "execute-api:Invoke",
                    "Resource": "arn:aws:execute-api:us-east-1:333333333333:API_ID/*",
                    "Condition": {
                        "StringNotEquals": {
                            "aws:SourceVpce": "vpce-XXXXXXXXXXXXXXXXX"
                        }
                    }
                }
            ]
        },

        "authorizerCredentials": "arn:aws:iam::333333333333:role/lambda_auth_role_InvokeFunction",
        "authorizerUri": "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:333333333333:function:api_gateway_authorizer_prod/invocations",

        "connectionId": "abc333",
        "host": "prod-api.execute-api.us-east-1.amazonaws.com",
        "hostPortal": "'https://portal.prod.example.com'",
        "nlb": "http://NLB-PROD.elb.us-east-1.amazonaws.com",

        "defaultGroups": ["Meu Grupo A", "Meu Grupo B"]
    }
];
