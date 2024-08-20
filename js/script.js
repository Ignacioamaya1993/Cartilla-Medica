// Variables globales
let professionals = [];
let currentPage = 1;
let recordsPerPage = 10;
let filteredProfessionals = [];
const excelFilePath = 'profesionales.xlsx';
const googleMapsApiKey = 'AIzaSyAyjnRLusJVkSsiJyssRPK2L6CB3hD1gN8';

// Llama a la función initMap cuando se necesita mostrar el mapa
function showMap(address) {
    var geocoder = new google.maps.Geocoder();

    geocoder.geocode({ 'address': address }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var lat = results[0].geometry.location.lat();
            var lng = results[0].geometry.location.lng();

            // Imprime las coordenadas en la consola para verificar
            console.log('Latitud:', lat, 'Longitud:', lng);

            Swal.fire({
                title: 'Ubicación',
                html: `<div id="map-container" style="width: 100%; height: 300px;">
                           <iframe id="map" width="100%" height="100%" frameborder="0" style="border:0" allowfullscreen></iframe>
                       </div>`,
                confirmButtonText: 'Cerrar',
                didOpen: () => {
                    const mapIframe = document.getElementById('map');
                    if (mapIframe) {
                        mapIframe.src = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${lat},${lng}`;
                    }
                },
                customClass: {
                    popup: 'swal2-popup-custom',
                    title: 'swal2-title-custom',
                    htmlContainer: 'swal2-html-custom',
                }
            });
        } else {
            console.error('Geocode no tuvo éxito debido a: ' + status);
            Swal.fire('Error', 'No se pudo mostrar la ubicación en el mapa', 'error');
        }
    });
}

// Función para cargar el archivo Excel
function loadExcelFile() {
    fetch(excelFilePath)
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            professionals = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            // Verifica la carga de datos
            console.log('Datos cargados:', professionals);

            populateSpecialtyFilter();
            updateProfessionals();
        })
        .catch(error => console.error('Error al leer el archivo Excel:', error));
}

// Función para actualizar la cantidad de registros por página
function updateRecordsPerPage() {
    recordsPerPage = parseInt(document.getElementById('recordsPerPage').value);
    currentPage = 1;
    updateProfessionals();
}

// Función para poblar el filtro de especialidades
function populateSpecialtyFilter() {
    const specialties = [...new Set(professionals.map(p => p.specialty))];
    const specialtyFilter = document.getElementById('specialtyFilter');
    specialtyFilter.innerHTML = '<option value="all">TODAS LAS ESPECIALIDADES</option>';

    specialties.forEach(specialty => {
        const option = document.createElement('option');
        option.value = specialty;
        option.textContent = specialty;
        specialtyFilter.appendChild(option);
    });
}

// Función para actualizar los profesionales mostrados
function updateProfessionals() {
    const searchQuery = document.getElementById('search').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;

    filteredProfessionals = professionals.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchQuery)) &&
        (selectedSpecialty === 'all' || p.specialty === selectedSpecialty)
    );

    currentPage = 1;
    renderProfessionals();
    updatePaginationInfo();
}

// Función para renderizar los profesionales en la tabla
function renderProfessionals() {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginatedProfessionals = filteredProfessionals.slice(startIndex, startIndex + recordsPerPage);

    const professionalList = document.getElementById('professionalList');
    professionalList.innerHTML = '';

    paginatedProfessionals.forEach(professional => {
        const fullAddress = `${professional.address || ''}, ${professional.city || ''}`;
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${professional.specialty || ''}</td>
            <td><span class="professional-link">${professional.name || ''}</span></td>
            <td>${professional.address || ''}</td>
            <td>${professional.city || ''}</td>
            <td>${professional.phone || ''}</td>
            <td>
                <button class="map-button" data-address="${fullAddress}">
                    <img src="img/maps.png" alt="Google Maps" width="40">
                </button>
            </td>`;
        
        professionalList.appendChild(row);
    });

    document.querySelectorAll('.map-button').forEach(button => {
        button.addEventListener('click', function () {
            const address = this.getAttribute('data-address');
            showMap(address);
        });
    });

    if (window.innerWidth <= 776) {
        document.querySelectorAll('.professional-link').forEach(link => {
            link.addEventListener('click', function () {
                const specialty = this.parentElement.previousElementSibling.textContent;
                const address = this.parentElement.nextElementSibling.textContent;
                const city = this.parentElement.nextElementSibling.nextElementSibling.textContent;
                const phone = this.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.textContent;

                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(address)}`;

                Swal.fire({
                    icon: 'info',
                    title: this.textContent,
                    html: `
                        <p><strong>Especialidad:</strong> ${specialty}</p>
                        <p><strong>Dirección:</strong> ${address}</p>
                        <p><strong>Localidad:</strong> ${city}</p>
                        <p><strong>Teléfono:</strong> ${phone}</p>
                        <iframe id="map" width="100%" height="200" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>
                    `,
                    customClass: {
                        popup: 'swal2-popup-custom',
                        title: 'swal2-title-custom',
                        htmlContainer: 'swal2-html-custom',
                    }
                });
            });
        });
    }
}

// Función para actualizar la información de paginación
function updatePaginationInfo() {
    const pageInfo = document.getElementById('pageInfo');
    pageInfo.textContent = `Página ${currentPage} de ${Math.ceil(filteredProfessionals.length / recordsPerPage)}`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === Math.ceil(filteredProfessionals.length / recordsPerPage);
}

// Función para cambiar de página
function changePage(direction) {
    currentPage += direction;
    renderProfessionals();
    updatePaginationInfo();
}

// Inicializa la aplicación cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    loadExcelFile();

    document.getElementById('recordsPerPage').addEventListener('change', updateRecordsPerPage);
    document.getElementById('search').addEventListener('input', updateProfessionals);
    document.getElementById('specialtyFilter').addEventListener('change', updateProfessionals);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
});

// Llama a la función para cargar la API de Google Maps de manera asíncrona
function loadGoogleMapsAPI() {
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
    }
}

// Evita errores si no necesitas la función initMap
function initMap() {
    // Esta función puede estar vacía si no estás usando un mapa globalmente
}

// Llama a la función para cargar la API de Google Maps
loadGoogleMapsAPI();