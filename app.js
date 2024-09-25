const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const axios = require('axios');

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {


// Ejecutar el comando 'oc get namespaces' y procesar la respuesta
exec('oc get namespaces -o json', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error ejecutando el comando: ${error.message}`);
      return;
    }
  
    if (stderr) {
      console.error(`Error en la salida del comando: ${stderr}`);
      return;
    }
  
    // Parsear la salida JSON
    const namespaces = JSON.parse(stdout);
  
    // Filtrar namespaces que contengan '-dev' en el nombre
    const devNamespaces = namespaces.items.filter(ns => ns.metadata.name.includes('-preprod'));
  
    // Crear la tabla HTML
    let htmlTable = `
      <html>
      <head><title>Developer Hub lab</title></head>
      <body>
         <h1>Summit Connect: monitoring tool</h1>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr>
            <th>Demos created</th>
          </tr>`;
  
    // Añadir filas a la tabla para cada namespace que contenga '-dev'
    devNamespaces.forEach(ns => {
      htmlTable += `<tr><td>${ns.metadata.name.slice(0, -8)}</td></tr>`;
    });
  
    htmlTable += `
        </table>
       <tr>
       <input type="button" value="Refresh" onclick="location.reload()">
       </tr>         
      <h1>Remove cluster resources</h1>
      <form action="/delete" method="post">
        Demo name: <input type="text" name="username" required><br><br>
        <input type="submit" value="Remove">
      </form>
        </body>
      </html>
      `;

    res.send(`${htmlTable}`

    );
});
});

app.post('/delete', async (req, res) => {
    const username = req.body.username;

    try {
        // Eliminar namespaces de OpenShift
        await deleteOpenShiftNamespaces(username);

        // Eliminar aplicaciones de Argo CD
        await deleteArgoCDApplications(username);

        // Eliminar repositorios de Quay
        await deleteQuayRepositories(username);

        // Eliminar repositorios de GitLab
        await deleteGitLabRepositories(username);



        res.send(`Se han eliminado los recursos asociados al usuario ${username}. <tr><input type="button" value="Back" onclick="window.history.back()"> </tr> `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocurrió un error al eliminar los recursos.');
    }
});

app.listen(3000, () => {
    console.log('La aplicación está escuchando en el puerto 3000');
});

// Función para eliminar namespaces de OpenShift
const deleteOpenShiftNamespaces = async (username) => {

        // DEVELOPMENT Namespace
        const namespace = `oc get namespace ${username}-dev`;
        if (namespace.length >0){
        const command = `oc delete namespace ${username}-dev`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                console.error(`Error ejecutando el comando: ${error.message}`);
                return;
                }   
                if (stderr) {
                console.error(`Error en la salida del comando: ${stderr}`);
                return;
                }
            // Mostrar la salida del comando
            console.log(`Eliminado namespace de OpenShift: ${username}-dev`);            
            });
        }
        // PREPROD Namespace
        command = `oc delete namespace ${username}-preprod`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
            console.error(`Error ejecutando el comando: ${error.message}`);
            return;
            }   
            if (stderr) {
            console.error(`Error en la salida del comando: ${stderr}`);
            return;
            }
            // Mostrar la salida del comando
            console.log(`Eliminado namespace de OpenShift: ${username}-preprod`);            
        });

        // PROD Namespace    
        command = `oc delete namespace ${username}-prod`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
            console.error(`Error ejecutando el comando: ${error.message}`);
            return;
            }   
            if (stderr) {
            console.error(`Error en la salida del comando: ${stderr}`);
            return;
            }
        // Mostrar la salida del comando
        console.log(`Eliminado namespace de OpenShift: ${username}-prod`);            
    });


};

// Función para eliminar aplicaciones de Argo CD
const deleteArgoCDApplications = async (username) => {
    const command = `oc delete applications.argoproj.io ${username}-bootstrap -n janus-argocd`;

    try {
        // Ejecutar el comando
        exec(command, (error, stdout, stderr) => {
            if (error) {
            console.error(`Error ejecutando el comando: ${error.message}`);
            return;
            }
        
            if (stderr) {
            console.error(`Error en la salida del comando: ${stderr}`);
            return;
            }
          // Mostrar la salida del comando
             console.log(`Resultado del comando:\n${stdout}`);
      });
  
    } catch (error) {
        console.error('Error al eliminar aplicaciones de Argo CD:', error);
        throw error;
    }
};

// Función para eliminar repositorios de GitLab
const deleteGitLabRepositories = async (username) => {
    const gitlabApiUrl = 'https://XXXXXXXXXXXXX/api/v4'; // Reemplazar con la URL de su instancia de GitLab, ex: https://gitlab-gitlab.apps.com/api/v4   
    const gitlabToken = 'YYYYYYYYYYYYYYYYYYYY'; // Reemplazar con su token personal de GitLab

    try {
        let page = 1;
        let perPage = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(`${gitlabApiUrl}/projects`, {
                headers: {
                    'Private-Token': gitlabToken,
                },
                params: {
                    membership: true,
                    page: page,
                    per_page: perPage,
                }
            });

            const projects = response.data;

            // Filtrar proyectos que contienen el nombre de usuario
            const userProjects = projects.filter(project => project.name.includes(username));

            // Eliminar cada proyecto
            for (const project of userProjects) {
                const projectId = project.id;
                await axios.delete(`${gitlabApiUrl}/projects/${projectId}`, {
                    headers: {
                        'Private-Token': gitlabToken,
                    },
                });
                console.log(`Eliminado repositorio de GitLab: ${project.name}`);
            }

            if (projects.length < perPage) {
                hasMore = false;
            } else {
                page++;
            }
        }
    } catch (error) {
        console.error('Error al eliminar repositorios de GitLab:', error);
        throw error;
    }
};

// Función para eliminar repositorios de Quay
const deleteQuayRepositories = async (username) => {
    const quayApiUrl = 'https://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/api/v1'; // Reemplazar con la URL de su API de Quay
    const quayToken = 'YYYYYYYYYYYYYYYYYYYYYYYYYYYYY'; // Reemplazar con su token de Quay
    // quayadmin+removeresources
    try {

            await axios.delete(`${quayApiUrl}/repository/quayadmin/${username}`, {
                headers: {
                    'Authorization': `Bearer ${quayToken}`,
                },
            });
            console.log(`Eliminado repositorio de Quay: ${username}`);

    } catch (error) {
        console.error('Error al eliminar repositorios de Quay:', error);
        throw error;
    }
};
